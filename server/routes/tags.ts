import z from 'zod'

import forge from '../forge'
import ideaBoxSchemas from '../schema'

export const list = forge
  .query()
  .description('Get all tags in a container')
  .input({
    query: z.object({
      container: z.string()
    })
  })
  .existenceCheck('query', {
    container: 'containers'
  })
  .callback(
    async ({ pb, query: { container } }) =>
      await pb.getFullList
        .collection('tags_aggregated')
        .filter([
          {
            field: 'container',
            operator: '=',
            value: container
          }
        ])
        .sort(['-amount'])
        .execute()
  )

export const create = forge
  .mutation()
  .description('Create a new tag')
  .input({
    body: ideaBoxSchemas.tags
  })
  .existenceCheck('query', {
    container: 'containers'
  })
  .statusCode(201)
  .callback(
    async ({ pb, body }) =>
      await pb.create.collection('tags').data(body).execute()
  )

export const update = forge
  .mutation()
  .description('Update an existing tag')
  .input({
    query: z.object({
      id: z.string()
    }),
    body: ideaBoxSchemas.tags.omit({
      container: true
    })
  })
  .existenceCheck('query', {
    id: 'tags'
  })
  .callback(
    async ({ pb, query: { id }, body }) =>
      await pb.update.collection('tags').id(id).data(body).execute()
  )

export const remove = forge
  .mutation()
  .description('Delete a tag')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'tags'
  })
  .statusCode(204)
  .callback(async ({ pb, query: { id } }) => {
    await pb.delete.collection('tags').id(id).execute()
  })
