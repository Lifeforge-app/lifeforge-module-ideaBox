import z from 'zod'

import forge from '../forge'
import ideaBoxSchemas from '../schema'

export const validate = forge
  .query()
  .description('Validate if a container exists')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .callback(
    async ({ pb, query: { id } }) =>
      !!(await pb.getOne
        .collection('containers')
        .id(id)
        .execute()
        .catch(() => {}))
  )

export const list = forge
  .query()
  .description('Get all containers with stats')
  .input({
    query: z.object({
      hidden: z
        .string()
        .optional()
        .transform(val => val === 'true')
    })
  })
  .callback(({ pb, query: { hidden } }) =>
    pb.getFullList
      .collection('containers_aggregated')
      .filter([
        !hidden
          ? {
              field: 'hidden',
              operator: '=',
              value: false
            }
          : undefined
      ])
      .sort(['hidden', '-pinned', 'name'])
      .execute()
  )

export const create = forge
  .mutation()
  .description('Create a new container')
  .input({
    body: ideaBoxSchemas.containers.omit({
      cover: true,
      hidden: true,
      pinned: true
    })
  })
  .media({
    cover: {
      optional: true
    }
  })
  .statusCode(201)
  .callback(
    async ({
      pb,
      body,
      media: { cover },
      core: {
        media: { retrieveMedia }
      }
    }) =>
      pb.create
        .collection('containers')
        .data({
          ...body,
          ...(await retrieveMedia('cover', cover))
        })
        .execute()
  )

export const update = forge
  .mutation()
  .description('Update an existing container')
  .input({
    query: z.object({
      id: z.string()
    }),
    body: ideaBoxSchemas.containers.omit({
      cover: true,
      hidden: true,
      pinned: true
    })
  })
  .media({
    cover: {
      optional: true
    }
  })
  .existenceCheck('query', {
    id: 'containers'
  })
  .callback(
    async ({
      pb,
      query: { id },
      body,
      media: { cover },
      core: {
        media: { retrieveMedia }
      }
    }) =>
      pb.update
        .collection('containers')
        .id(id)
        .data({
          ...body,
          ...(await retrieveMedia('cover', cover))
        })
        .execute()
  )

export const remove = forge
  .mutation()
  .description('Delete a container')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'containers'
  })
  .statusCode(204)
  .callback(async ({ pb, query: { id } }) =>
    pb.delete.collection('containers').id(id).execute()
  )

export const togglePin = forge
  .mutation()
  .description('Toggle pin status of a container')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'containers'
  })
  .callback(async ({ pb, query: { id } }) => {
    const container = await pb.getOne.collection('containers').id(id).execute()

    return pb.update
      .collection('containers')
      .id(id)
      .data({
        pinned: !container.pinned
      })
      .execute()
  })

export const toggleHide = forge
  .mutation()
  .description('Toggle visibility of a container')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'containers'
  })
  .callback(async ({ pb, query: { id } }) => {
    const container = await pb.getOne.collection('containers').id(id).execute()

    return pb.update
      .collection('containers')
      .id(id)
      .data({
        hidden: !container.hidden,
        pinned: false
      })
      .execute()
  })
