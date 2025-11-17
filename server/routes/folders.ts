import { forgeController, forgeRouter } from '@functions/routes'
import { ClientError } from '@functions/routes/utils/response'
import { SCHEMAS } from '@schema'
import z from 'zod'

import { validateFolderPath } from '../utils/folders'

const list = forgeController
  .query()
  .description({
    en: 'Get all folders in a path',
    ms: 'Dapatkan semua folder dalam laluan',
    'zh-CN': '获取路径中的所有文件夹',
    'zh-TW': '獲取路徑中的所有資料夾'
  })
  .input({
    query: z.object({
      container: z.string(),
      path: z.string()
    })
  })
  .existenceCheck('query', {
    container: 'idea_box__containers'
  })
  .callback(async ({ pb, query }) => {
    const { container, path } = query

    const pathSegments = path.split('/').filter(p => p !== '')

    const { folderExists, lastFolder } = await validateFolderPath(
      pb,
      container,
      pathSegments
    )

    if (!folderExists) {
      throw new ClientError(
        `Folder with path "${path}" does not exist in container "${container}"`
      )
    }

    return await pb.getFullList
      .collection('idea_box__folders')
      .filter([
        {
          field: 'container',
          operator: '=',
          value: container
        },
        {
          field: 'parent',
          operator: '=',
          value: lastFolder
        }
      ])
      .sort(['name'])
      .execute()
  })

const create = forgeController
  .mutation()
  .description({
    en: 'Create a new folder',
    ms: 'Cipta folder baharu',
    'zh-CN': '创建新文件夹',
    'zh-TW': '創建新資料夾'
  })
  .input({
    body: SCHEMAS.idea_box.folders.schema
  })
  .existenceCheck('body', {
    container: 'idea_box__containers',
    parent: '[idea_box__folders]'
  })
  .callback(
    async ({ pb, body }) =>
      await pb.create.collection('idea_box__folders').data(body).execute()
  )
  .statusCode(201)

const update = forgeController
  .mutation()
  .description({
    en: 'Update folder details',
    ms: 'Kemas kini butiran folder',
    'zh-CN': '更新文件夹详情',
    'zh-TW': '更新資料夾詳情'
  })
  .input({
    query: z.object({
      id: z.string()
    }),
    body: SCHEMAS.idea_box.folders.schema.omit({
      container: true,
      parent: true
    })
  })
  .existenceCheck('query', {
    id: 'idea_box__folders'
  })
  .callback(
    async ({ pb, query: { id }, body }) =>
      await pb.update
        .collection('idea_box__folders')
        .id(id)
        .data(body)
        .execute()
  )

const moveTo = forgeController
  .mutation()
  .description({
    en: 'Move folder to another parent',
    ms: 'Pindah folder ke induk lain',
    'zh-CN': '将文件夹移至另一个父级',
    'zh-TW': '將資料夾移至另一個父級'
  })
  .input({
    query: z.object({
      id: z.string()
    }),
    body: z.object({
      target: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'idea_box__folders'
  })
  .existenceCheck('body', {
    target: 'idea_box__folders'
  })
  .callback(
    async ({ pb, query: { id }, body: { target } }) =>
      await pb.update
        .collection('idea_box__folders')
        .id(id)
        .data({
          parent: target
        })
        .execute()
  )

const removeFromParent = forgeController
  .mutation()
  .description({
    en: 'Move folder to parent folder',
    ms: 'Pindah folder ke folder induk',
    'zh-CN': '将文件夹移至上级文件夹',
    'zh-TW': '將資料夾移至上級資料夾'
  })
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'idea_box__folders'
  })
  .callback(async ({ pb, query: { id } }) => {
    const currentFolder = await pb.getOne
      .collection('idea_box__folders')
      .id(id)
      .execute()

    if (!currentFolder.parent) {
      throw new ClientError('Folder is already at root level')
    }

    const parentFolder = await pb.getOne
      .collection('idea_box__folders')
      .id(currentFolder.parent)
      .execute()

    return await pb.update
      .collection('idea_box__folders')
      .id(id)
      .data({
        parent: parentFolder.parent || null
      })
      .execute()
  })

const remove = forgeController
  .mutation()
  .description({
    en: 'Delete a folder',
    ms: 'Padam folder',
    'zh-CN': '删除文件夹',
    'zh-TW': '刪除資料夾'
  })
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'idea_box__folders'
  })
  .callback(async ({ pb, query: { id } }) => {
    await pb.delete.collection('idea_box__folders').id(id).execute()
  })
  .statusCode(204)

export default forgeRouter({
  list,
  create,
  update,
  moveTo,
  removeFromParent,
  remove
})
