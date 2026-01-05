import ogs from 'open-graph-scraper'
import z from 'zod'

import { checkExistence } from '@functions/database'
import { LoggingService } from '@functions/logging/loggingService'
import { forgeController, forgeRouter } from '@functions/routes'
import { ClientError } from '@functions/routes/utils/response'

import { recursivelySearchFolder } from '../utils/folders'

const OGCache = new Map<string, any>()

const getPath = forgeController
  .query()
  .description({
    en: 'Get path information for a container or folder',
    ms: 'Dapatkan maklumat laluan untuk bekas atau folder',
    'zh-CN': '获取容器或文件夹的路径信息',
    'zh-TW': '獲取容器或資料夾的路徑資訊'
  })
  .input({
    query: z.object({
      container: z.string(),
      folder: z.string().optional()
    })
  })
  .existenceCheck('query', {
    container: 'ideaBox__containers',
    folder: '[ideaBox__folders]'
  })
  .callback(async ({ pb, query: { container, folder } }) => {
    const containerEntry = await pb.getOne
      .collection('ideaBox__containers')
      .id(container)
      .execute()

    if (!folder) {
      return {
        container: containerEntry,
        route: []
      }
    }

    let lastFolder = folder

    const fullPath = []

    while (lastFolder) {
      if (!(await checkExistence(pb, 'ideaBox__folders', lastFolder))) {
        throw new ClientError(`Folder with ID "${lastFolder}" does not exist`)
      }

      const folderEntry = await pb.getOne
        .collection('ideaBox__folders')
        .id(lastFolder)
        .execute()

      if (folderEntry.container !== container) {
        throw new ClientError('Invalid path')
      }

      lastFolder = folderEntry.parent
      fullPath.unshift(folderEntry)
    }

    return {
      container: containerEntry,
      route: fullPath
    }
  })

const checkValid = forgeController
  .query()
  .description({
    en: 'Validate if a folder path exists',
    ms: 'Sahkan sama ada laluan folder wujud',
    'zh-CN': '验证文件夹路径是否存在',
    'zh-TW': '驗證資料夾路徑是否存在'
  })
  .input({
    query: z.object({
      container: z.string(),
      path: z.string()
    })
  })
  .callback(async ({ pb, query: { container, path } }) => {
    const containerExists = await checkExistence(
      pb,
      'ideaBox__containers',
      container
    )

    if (!containerExists) {
      return false
    }

    let folderExists = true
    let lastFolder = ''

    for (const folder of path.split('/').filter(e => e)) {
      if (!(await checkExistence(pb, 'ideaBox__folders', folder))) {
        folderExists = false
        break
      }

      const folderEntry = await pb.getOne
        .collection('ideaBox__folders')
        .id(folder)
        .execute()

      if (
        folderEntry.parent !== lastFolder ||
        folderEntry.container !== container
      ) {
        folderExists = false
        break
      }

      lastFolder = folder
    }

    return containerExists && folderExists
  })

const getOgData = forgeController
  .query()
  .description({
    en: 'Get Open Graph metadata for a link entry',
    ms: 'Dapatkan metadata Open Graph untuk entri pautan',
    'zh-CN': '获取链接条目的Open Graph元数据',
    'zh-TW': '獲取連結條目的Open Graph元數據'
  })
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'ideaBox__entries'
  })
  .callback(async ({ pb, query: { id } }) => {
    const data = await pb.getFirstListItem
      .collection('ideaBox__entries_link')
      .filter([
        {
          field: 'base_entry',
          operator: '=',
          value: id
        }
      ])
      .execute()

    if (OGCache.has(id) && OGCache.get(id)?.requestUrl === data.link) {
      return OGCache.get(id)
    }

    const { result } = await ogs({
      url: data.link,
      fetchOptions: {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
        }
      }
    }).catch(() => {
      LoggingService.error(
        `Error fetching Open Graph data: ${data.link}`,
        'OG SCraper'
      )

      return { result: null }
    })

    OGCache.set(id, { ...result, requestUrl: data.link })

    return result
  })

const search = forgeController
  .query()
  .description({
    en: 'Search entries in a container',
    ms: 'Cari entri dalam bekas',
    'zh-CN': '搜索容器中的条目',
    'zh-TW': '搜尋容器中的條目'
  })
  .input({
    query: z.object({
      q: z.string(),
      container: z.string(),
      tags: z.string().optional(),
      folder: z.string().optional()
    })
  })
  .existenceCheck('query', {
    container: '[ideaBox__containers]'
  })
  .callback(async ({ pb, query: { q, container, tags, folder } }) => {
    const results = await recursivelySearchFolder(
      folder || '',
      q,
      container,
      tags,
      '',
      pb
    )

    return results
  })

export default forgeRouter({
  getPath,
  checkValid,
  getOgData,
  search
})
