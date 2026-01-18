import { ClientError } from '@lifeforge/server-utils'
import z from 'zod'

import forge from '../forge'
import ideaBoxSchemas from '../schema'
import { validateFolderPath } from '../utils/folders'

export const list = forge
  .query()
  .description('Get all folders in a path')
  .input({
    query: z.object({
      container: z.string(),
      path: z.string()
    })
  })
  .existenceCheck('query', {
    container: 'containers'
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
      .collection('folders')
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

export const create = forge
  .mutation()
  .description('Create a new folder')
  .input({
    body: ideaBoxSchemas.folders
  })
  .existenceCheck('body', {
    container: 'containers',
    parent: '[folders]'
  })
  .callback(
    async ({ pb, body }) =>
      await pb.create.collection('folders').data(body).execute()
  )
  .statusCode(201)

export const update = forge
  .mutation()
  .description('Update folder details')
  .input({
    query: z.object({
      id: z.string()
    }),
    body: ideaBoxSchemas.folders.omit({
      container: true,
      parent: true
    })
  })
  .existenceCheck('query', {
    id: 'folders'
  })
  .callback(
    async ({ pb, query: { id }, body }) =>
      await pb.update.collection('folders').id(id).data(body).execute()
  )

export const moveTo = forge
  .mutation()
  .description('Move folder to another parent')
  .input({
    query: z.object({
      id: z.string()
    }),
    body: z.object({
      target: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'folders'
  })
  .existenceCheck('body', {
    target: 'folders'
  })
  .callback(
    async ({ pb, query: { id }, body: { target } }) =>
      await pb.update
        .collection('folders')
        .id(id)
        .data({
          parent: target
        })
        .execute()
  )

export const removeFromParent = forge
  .mutation()
  .description('Move folder to parent folder')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'folders'
  })
  .callback(async ({ pb, query: { id } }) => {
    const currentFolder = await pb.getOne.collection('folders').id(id).execute()

    if (!currentFolder.parent) {
      throw new ClientError('Folder is already at root level')
    }

    const parentFolder = await pb.getOne
      .collection('folders')
      .id(currentFolder.parent)
      .execute()

    return await pb.update
      .collection('folders')
      .id(id)
      .data({
        parent: parentFolder.parent || null
      })
      .execute()
  })

export const remove = forge
  .mutation()
  .description('Delete a folder')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'folders'
  })
  .callback(async ({ pb, query: { id } }) => {
    await pb.delete.collection('folders').id(id).execute()
  })
  .statusCode(204)
