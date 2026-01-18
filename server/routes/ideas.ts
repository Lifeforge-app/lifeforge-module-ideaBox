import { ClientError, type SchemaWithPB } from '@lifeforge/server-utils'
import z from 'zod'

import forge from '../forge'
import ideaBoxSchemas from '../schema'
import { validateFolderPath } from '../utils/folders'

export const list = forge
  .query()
  .description('Get all ideas from a folder or idea container')
  .input({
    query: z.object({
      container: z.string(),
      path: z.string(),
      archived: z
        .string()
        .optional()
        .transform(val => val === 'true')
    })
  })
  .existenceCheck('query', {
    container: 'containers'
  })
  .callback(async ({ pb, query: { path: pathParam, container, archived } }) => {
    const path = pathParam.split('/').filter(e => e)

    const { folderExists, lastFolder } = await validateFolderPath(
      pb,
      container,
      path
    )

    if (!folderExists) {
      throw new ClientError(
        `Folder with path "${pathParam}" does not exist in container "${container}"`
      )
    }

    const textIdeas = await pb.getFullList
      .collection('entries_text')
      .expand({
        base_entry: 'entries'
      })
      .filter([
        {
          field: 'base_entry.container',
          operator: '=',
          value: container
        },
        {
          field: 'base_entry.archived',
          operator: '=',
          value: archived
        },
        {
          field: 'base_entry.folder',
          operator: '=',
          value: lastFolder || ''
        }
      ])
      .sort(['-base_entry.pinned', '-base_entry.created'])
      .execute()

    const imageIdeas = await pb.getFullList
      .collection('entries_image')
      .expand({
        base_entry: 'entries'
      })
      .filter([
        {
          field: 'base_entry.container',
          operator: '=',
          value: container
        },
        {
          field: 'base_entry.archived',
          operator: '=',
          value: archived
        },
        {
          field: 'base_entry.folder',
          operator: '=',
          value: lastFolder || ''
        }
      ])
      .sort(['-base_entry.pinned', '-base_entry.created'])
      .execute()

    const linkIdeas = await pb.getFullList
      .collection('entries_link')
      .expand({
        base_entry: 'entries'
      })
      .filter([
        {
          field: 'base_entry.container',
          operator: '=',
          value: container
        },
        {
          field: 'base_entry.archived',
          operator: '=',
          value: archived
        },
        {
          field: 'base_entry.folder',
          operator: '=',
          value: lastFolder || ''
        }
      ])
      .sort(['-base_entry.pinned', '-base_entry.created'])
      .execute()

    const _returnSchema = ideaBoxSchemas.entries
      .omit({
        type: true
      })
      .and(
        z.union([
          ideaBoxSchemas.entries_text.extend({
            type: z.literal('text')
          }),
          ideaBoxSchemas.entries_image.extend({
            type: z.literal('image'),
            child: z.object({
              id: z.string(),
              collectionId: z.string()
            })
          }),
          ideaBoxSchemas.entries_link.extend({
            type: z.literal('link')
          })
        ])
      )

    return [
      ...textIdeas.map(idea => ({
        ...idea.expand!.base_entry,
        content: idea.content,
        type: 'text'
      })),
      ...imageIdeas.map(idea => ({
        ...idea.expand!.base_entry,
        child: {
          id: idea.id,
          collectionId: idea.collectionId
        },
        image: idea.image
      })),
      ...linkIdeas.map(idea => ({
        ...idea.expand!.base_entry,
        link: idea.link
      }))
    ].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1

      return new Date(b.created!).getTime() - new Date(a.created!).getTime()
    }) as Array<SchemaWithPB<z.infer<typeof _returnSchema>>>
  })

const createSchema = ideaBoxSchemas.entries
  .omit({
    created: true,
    updated: true,
    type: true,
    archived: true,
    pinned: true
  })
  .and(
    z.union([
      ideaBoxSchemas.entries_text
        .omit({
          base_entry: true
        })
        .extend({
          type: z.literal('text')
        }),
      ideaBoxSchemas.entries_image
        .omit({
          base_entry: true,
          image: true
        })
        .extend({
          type: z.literal('image')
        }),
      ideaBoxSchemas.entries_link
        .omit({
          base_entry: true
        })
        .extend({
          type: z.literal('link')
        })
    ])
  )

export const create = forge
  .mutation()
  .description('Create a new idea entry')
  .input({
    body: createSchema
  })
  .media({
    image: {
      optional: true
    }
  })
  .existenceCheck('body', {
    container: 'containers',
    folder: '[folders]'
  })
  .statusCode(201)
  .callback(
    async ({
      pb,
      body: rawBody,
      media: { image },
      core: {
        media: { retrieveMedia }
      }
    }) => {
      const body = rawBody as z.infer<typeof createSchema>

      const baseEntry = await pb.create
        .collection('entries')
        .data({
          container: body.container,
          folder: body.folder,
          type: body.type,
          tags: body.tags
        })
        .execute()

      if (body.type === 'text') {
        await pb.create
          .collection('entries_text')
          .data({
            base_entry: baseEntry.id,
            content: body.content
          })
          .execute()
      } else if (body.type === 'image') {
        if (!image) {
          throw new ClientError('Image is required for image entries')
        }

        const imageData = await retrieveMedia('image', image)

        await pb.create
          .collection('entries_image')
          .data({
            base_entry: baseEntry.id,
            ...imageData
          })
          .execute()
      } else if (body.type === 'link') {
        await pb.create
          .collection('entries_link')
          .data({
            base_entry: baseEntry.id,
            link: body.link
          })
          .execute()
      }
    }
  )

const updateSchema = ideaBoxSchemas.entries
  .omit({
    created: true,
    updated: true,
    type: true,
    folder: true,
    container: true,
    archived: true,
    pinned: true
  })
  .and(
    z.union([
      ideaBoxSchemas.entries_text
        .omit({
          base_entry: true
        })
        .extend({
          type: z.literal('text')
        }),
      ideaBoxSchemas.entries_image
        .omit({
          base_entry: true,
          image: true
        })
        .extend({
          type: z.literal('image')
        }),
      ideaBoxSchemas.entries_link
        .omit({
          base_entry: true
        })
        .extend({
          type: z.literal('link')
        })
    ])
  )

export const update = forge
  .mutation()
  .description('Update an existing idea')
  .input({
    query: z.object({
      id: z.string()
    }),
    body: updateSchema
  })
  .media({
    image: {
      optional: true
    }
  })
  .existenceCheck('query', {
    id: 'entries'
  })
  .callback(
    async ({
      pb,
      query: { id },
      body: rawBody,
      media: { image },
      core: {
        media: { retrieveMedia }
      }
    }) => {
      const body = rawBody as z.infer<typeof createSchema>

      const baseIdea = await pb.update
        .collection('entries')
        .id(id)
        .data({
          type: body.type,
          tags: body.tags
        })
        .execute()

      if (body.type === 'text') {
        const existingText = await pb.getFirstListItem
          .collection('entries_text')
          .filter([
            {
              field: 'base_entry',
              operator: '=',
              value: baseIdea.id
            }
          ])
          .execute()

        await pb.update
          .collection('entries_text')
          .id(existingText.id)
          .data({
            content: body.content
          })
          .execute()
      } else if (body.type === 'image') {
        if (!image) {
          throw new ClientError('Image is required for image entries')
        }

        const existingImage = await pb.getFirstListItem
          .collection('entries_image')
          .filter([
            {
              field: 'base_entry',
              operator: '=',
              value: baseIdea.id
            }
          ])
          .execute()

        const imageData = await retrieveMedia('image', image)

        await pb.update
          .collection('entries_image')
          .id(existingImage.id)
          .data({
            ...imageData
          })
          .execute()
      } else if (body.type === 'link') {
        const existingLink = await pb.getFirstListItem
          .collection('entries_link')
          .filter([
            {
              field: 'base_entry',
              operator: '=',
              value: baseIdea.id
            }
          ])
          .execute()

        await pb.update
          .collection('entries_link')
          .id(existingLink.id)
          .data({
            link: body.link
          })
          .execute()
      } else {
        throw new ClientError('Invalid idea type')
      }
    }
  )

export const remove = forge
  .mutation()
  .description('Delete an idea')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'entries'
  })
  .callback(({ pb, query: { id } }) =>
    pb.delete.collection('entries').id(id).execute()
  )
  .statusCode(204)

export const pin = forge
  .mutation()
  .description('Toggle pin status of an idea')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'entries'
  })
  .callback(async ({ pb, query: { id } }) => {
    const idea = await pb.getOne.collection('entries').id(id).execute()

    return await pb.update
      .collection('entries')
      .id(id)
      .data({
        pinned: !idea.pinned
      })
      .execute()
  })

export const archive = forge
  .mutation()
  .description('Toggle archive status of an idea')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'entries'
  })
  .callback(async ({ pb, query: { id } }) => {
    const idea = await pb.getOne.collection('entries').id(id).execute()

    return await pb.update
      .collection('entries')
      .id(id)
      .data({
        archived: !idea.archived,
        pinned: false
      })
      .execute()
  })

export const moveTo = forge
  .mutation()
  .description('Move an idea to another folder')
  .input({
    query: z.object({
      id: z.string()
    }),
    body: z.object({
      target: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'entries'
  })
  .existenceCheck('body', {
    target: 'folders'
  })
  .callback(({ pb, query: { id }, body: { target } }) =>
    pb.update
      .collection('entries')
      .id(id)
      .data({
        folder: target
      })
      .execute()
  )

export const removeFromParent = forge
  .mutation()
  .description('Move idea to parent folder')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'entries'
  })
  .callback(async ({ pb, query: { id } }) => {
    const currentIdea = await pb.getOne.collection('entries').id(id).execute()

    if (!currentIdea.folder) {
      throw new ClientError('Idea is not in any folder')
    }

    const currentFolder = await pb.getOne
      .collection('folders')
      .id(currentIdea.folder)
      .execute()

    if (!currentFolder) {
      throw new ClientError('Current folder does not exist')
    }

    await pb.update
      .collection('entries')
      .id(id)
      .data({
        folder: currentFolder.parent || ''
      })
      .execute()
  })
