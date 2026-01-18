import { ClientError } from '@lifeforge/server-utils'
import ogs from 'open-graph-scraper'
import z from 'zod'

import forge from '../forge'
import { recursivelySearchFolder } from '../utils/folders'

const OGCache = new Map<string, any>()

export const getPath = forge
  .query()
  .description('Get path information for a container or folder')
  .input({
    query: z.object({
      container: z.string(),
      folder: z.string().optional()
    })
  })
  .existenceCheck('query', {
    container: 'containers',
    folder: '[folders]'
  })
  .callback(
    async ({
      pb,
      query: { container, folder },
      core: {
        validation: { checkRecordExistence }
      }
    }) => {
      const containerEntry = await pb.getOne
        .collection('containers')
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
        if (!(await checkRecordExistence(pb, 'folders', lastFolder))) {
          throw new ClientError(`Folder with ID "${lastFolder}" does not exist`)
        }

        const folderEntry = await pb.getOne
          .collection('folders')
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
    }
  )

export const checkValid = forge
  .query()
  .description('Validate if a folder path exists')
  .input({
    query: z.object({
      container: z.string(),
      path: z.string()
    })
  })
  .callback(
    async ({
      pb,
      query: { container, path },
      core: {
        validation: { checkRecordExistence }
      }
    }) => {
      const containerExists = await checkRecordExistence(
        pb,
        'containers',
        container
      )

      if (!containerExists) {
        return false
      }

      let folderExists = true
      let lastFolder = ''

      for (const folder of path.split('/').filter(e => e)) {
        if (!(await checkRecordExistence(pb, 'folders', folder))) {
          folderExists = false
          break
        }

        const folderEntry = await pb.getOne
          .collection('folders')
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
    }
  )

export const getOgData = forge
  .query()
  .description('Get Open Graph metadata for a link entry')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'entries'
  })
  .callback(async ({ pb, query: { id }, core: { logging } }) => {
    const data = await pb.getFirstListItem
      .collection('entries_link')
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
      logging.error(`Error fetching Open Graph data: ${data.link}`)

      return { result: null }
    })

    OGCache.set(id, { ...result, requestUrl: data.link })

    return result
  })

export const search = forge
  .query()
  .description('Search entries in a container')
  .input({
    query: z.object({
      q: z.string(),
      container: z.string(),
      tags: z.string().optional(),
      folder: z.string().optional()
    })
  })
  .existenceCheck('query', {
    container: '[containers]'
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
