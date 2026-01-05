import COLLECTION_SCHEMAS, { SCHEMAS } from '@schema'
import z from 'zod'

import { SchemaWithPB } from '@functions/database/PBService/typescript/pb_service'
import getMedia from '@functions/external/media'
import { forgeController, forgeRouter } from '@functions/routes'
import { ClientError } from '@functions/routes/utils/response'

import { validateFolderPath } from '../utils/folders'

const list = forgeController
  .query()
  .description({
    en: 'Get all ideas from a folder or idea container',
    ms: 'Dapatkan semua idea daripada folder atau bekas idea',
    'zh-CN': '获取文件夹中的所有想法或想法容器',
    'zh-TW': '獲取資料夾中的所有想法或想法容器'
  })
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
    container: 'ideaBox__containers'
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
      .collection('ideaBox__entries_text')
      .expand({
        base_entry: 'ideaBox__entries'
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
      .collection('ideaBox__entries_image')
      .expand({
        base_entry: 'ideaBox__entries'
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
      .collection('ideaBox__entries_link')
      .expand({
        base_entry: 'ideaBox__entries'
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

    const _returnSchema = COLLECTION_SCHEMAS.ideaBox__entries
      .omit({
        type: true
      })
      .and(
        z.union([
          COLLECTION_SCHEMAS.ideaBox__entries_text.extend({
            type: z.literal('text')
          }),
          COLLECTION_SCHEMAS.ideaBox__entries_image.extend({
            type: z.literal('image'),
            child: z.object({
              id: z.string(),
              collectionId: z.string()
            })
          }),
          COLLECTION_SCHEMAS.ideaBox__entries_link.extend({
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

const createSchema = SCHEMAS.ideaBox.entries.schema
  .omit({
    created: true,
    updated: true,
    type: true,
    archived: true,
    pinned: true
  })
  .and(
    z.union([
      SCHEMAS.ideaBox.entries_text.schema
        .omit({
          base_entry: true
        })
        .extend({
          type: z.literal('text')
        }),
      SCHEMAS.ideaBox.entries_image.schema
        .omit({
          base_entry: true,
          image: true
        })
        .extend({
          type: z.literal('image')
        }),
      SCHEMAS.ideaBox.entries_link.schema
        .omit({
          base_entry: true
        })
        .extend({
          type: z.literal('link')
        })
    ])
  )

const create = forgeController
  .mutation()
  .description({
    en: 'Create a new idea entry',
    ms: 'Cipta entri idea baharu',
    'zh-CN': '创建新的想法条目',
    'zh-TW': '創建新的想法條目'
  })
  .input({
    body: createSchema
  })
  .media({
    image: {
      optional: true
    }
  })
  .existenceCheck('body', {
    container: 'ideaBox__containers',
    folder: '[ideaBox__folders]'
  })
  .statusCode(201)
  .callback(async ({ pb, body: rawBody, media: { image } }) => {
    const body = rawBody as z.infer<typeof createSchema>

    const baseEntry = await pb.create
      .collection('ideaBox__entries')
      .data({
        container: body.container,
        folder: body.folder,
        type: body.type,
        tags: body.tags
      })
      .execute()

    if (body.type === 'text') {
      await pb.create
        .collection('ideaBox__entries_text')
        .data({
          base_entry: baseEntry.id,
          content: body.content
        })
        .execute()
    } else if (body.type === 'image') {
      if (!image) {
        throw new ClientError('Image is required for image entries')
      }

      const imageData = await getMedia('image', image)

      await pb.create
        .collection('ideaBox__entries_image')
        .data({
          base_entry: baseEntry.id,
          ...imageData
        })
        .execute()
    } else if (body.type === 'link') {
      await pb.create
        .collection('ideaBox__entries_link')
        .data({
          base_entry: baseEntry.id,
          link: body.link
        })
        .execute()
    }
  })

const updateSchema = SCHEMAS.ideaBox.entries.schema
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
      SCHEMAS.ideaBox.entries_text.schema
        .omit({
          base_entry: true
        })
        .extend({
          type: z.literal('text')
        }),
      SCHEMAS.ideaBox.entries_image.schema
        .omit({
          base_entry: true,
          image: true
        })
        .extend({
          type: z.literal('image')
        }),
      SCHEMAS.ideaBox.entries_link.schema
        .omit({
          base_entry: true
        })
        .extend({
          type: z.literal('link')
        })
    ])
  )

const update = forgeController
  .mutation()
  .description({
    en: 'Update an existing idea',
    ms: 'Kemas kini idea sedia ada',
    'zh-CN': '更新现有想法',
    'zh-TW': '更新現有想法'
  })
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
    id: 'ideaBox__entries'
  })
  .callback(async ({ pb, query: { id }, body: rawBody, media: { image } }) => {
    const body = rawBody as z.infer<typeof createSchema>

    const baseIdea = await pb.update
      .collection('ideaBox__entries')
      .id(id)
      .data({
        type: body.type,
        tags: body.tags
      })
      .execute()

    if (body.type === 'text') {
      const existingText = await pb.getFirstListItem
        .collection('ideaBox__entries_text')
        .filter([
          {
            field: 'base_entry',
            operator: '=',
            value: baseIdea.id
          }
        ])
        .execute()

      await pb.update
        .collection('ideaBox__entries_text')
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
        .collection('ideaBox__entries_image')
        .filter([
          {
            field: 'base_entry',
            operator: '=',
            value: baseIdea.id
          }
        ])
        .execute()

      const imageData = await getMedia('image', image)

      await pb.update
        .collection('ideaBox__entries_image')
        .id(existingImage.id)
        .data({
          ...imageData
        })
        .execute()
    } else if (body.type === 'link') {
      const existingLink = await pb.getFirstListItem
        .collection('ideaBox__entries_link')
        .filter([
          {
            field: 'base_entry',
            operator: '=',
            value: baseIdea.id
          }
        ])
        .execute()

      await pb.update
        .collection('ideaBox__entries_link')
        .id(existingLink.id)
        .data({
          link: body.link
        })
        .execute()
    } else {
      throw new ClientError('Invalid idea type')
    }
  })

const remove = forgeController
  .mutation()
  .description({
    en: 'Delete an idea',
    ms: 'Padam idea',
    'zh-CN': '删除想法',
    'zh-TW': '刪除想法'
  })
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'ideaBox__entries'
  })
  .callback(({ pb, query: { id } }) =>
    pb.delete.collection('ideaBox__entries').id(id).execute()
  )
  .statusCode(204)

const pin = forgeController
  .mutation()
  .description({
    en: 'Toggle pin status of an idea',
    ms: 'Togol status pin idea',
    'zh-CN': '切换想法的置顶状态',
    'zh-TW': '切換想法的置頂狀態'
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
    const idea = await pb.getOne.collection('ideaBox__entries').id(id).execute()

    return await pb.update
      .collection('ideaBox__entries')
      .id(id)
      .data({
        pinned: !idea.pinned
      })
      .execute()
  })

const archive = forgeController
  .mutation()
  .description({
    en: 'Toggle archive status of an idea',
    ms: 'Togol status arkib idea',
    'zh-CN': '切换想法的归档状态',
    'zh-TW': '切換想法的封存狀態'
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
    const idea = await pb.getOne.collection('ideaBox__entries').id(id).execute()

    return await pb.update
      .collection('ideaBox__entries')
      .id(id)
      .data({
        archived: !idea.archived,
        pinned: false
      })
      .execute()
  })

const moveTo = forgeController
  .mutation()
  .description({
    en: 'Move an idea to another folder',
    ms: 'Pindah idea ke folder lain',
    'zh-CN': '将想法移动到另一个文件夹',
    'zh-TW': '將想法移動到另一個資料夾'
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
    id: 'ideaBox__entries'
  })
  .existenceCheck('body', {
    target: 'ideaBox__folders'
  })
  .callback(({ pb, query: { id }, body: { target } }) =>
    pb.update
      .collection('ideaBox__entries')
      .id(id)
      .data({
        folder: target
      })
      .execute()
  )

const removeFromParent = forgeController
  .mutation()
  .description({
    en: 'Move idea to parent folder',
    ms: 'Pindah idea ke folder induk',
    'zh-CN': '将想法移至父文件夹',
    'zh-TW': '將想法移至父資料夾'
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
    const currentIdea = await pb.getOne
      .collection('ideaBox__entries')
      .id(id)
      .execute()

    if (!currentIdea.folder) {
      throw new ClientError('Idea is not in any folder')
    }

    const currentFolder = await pb.getOne
      .collection('ideaBox__folders')
      .id(currentIdea.folder)
      .execute()

    if (!currentFolder) {
      throw new ClientError('Current folder does not exist')
    }

    await pb.update
      .collection('ideaBox__entries')
      .id(id)
      .data({
        folder: currentFolder.parent || ''
      })
      .execute()
  })

export default forgeRouter({
  list,
  create,
  update,
  remove,
  pin,
  archive,
  moveTo,
  removeFromParent
})
