import { SCHEMAS } from '@schema'
import z from 'zod'

import getMedia from '@functions/external/media'
import { forgeController, forgeRouter } from '@functions/routes'

const validate = forgeController
  .query()
  .description({
    en: 'Validate if a container exists',
    ms: 'Sahkan sama ada bekas wujud',
    'zh-CN': '验证容器是否存在',
    'zh-TW': '驗證容器是否存在'
  })
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .callback(
    async ({ pb, query: { id } }) =>
      !!(await pb.getOne
        .collection('ideaBox__containers')
        .id(id)
        .execute()
        .catch(() => {}))
  )

const list = forgeController
  .query()
  .description({
    en: 'Get all containers with stats',
    ms: 'Dapatkan semua bekas dengan statistik',
    'zh-CN': '获取所有容器及统计信息',
    'zh-TW': '獲取所有容器及統計資訊'
  })
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
      .collection('ideaBox__containers_aggregated')
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

const create = forgeController
  .mutation()
  .description({
    en: 'Create a new container',
    ms: 'Cipta bekas baharu',
    'zh-CN': '创建新容器',
    'zh-TW': '創建新容器'
  })
  .input({
    body: SCHEMAS.ideaBox.containers.schema.omit({
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
  .callback(async ({ pb, body, media: { cover } }) =>
    pb.create
      .collection('ideaBox__containers')
      .data({
        ...body,
        ...(await getMedia('cover', cover))
      })
      .execute()
  )

const update = forgeController
  .mutation()
  .description({
    en: 'Update an existing container',
    ms: 'Kemas kini bekas sedia ada',
    'zh-CN': '更新现有容器',
    'zh-TW': '更新現有容器'
  })
  .input({
    query: z.object({
      id: z.string()
    }),
    body: SCHEMAS.ideaBox.containers.schema.omit({
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
    id: 'ideaBox__containers'
  })
  .callback(async ({ pb, query: { id }, body, media: { cover } }) =>
    pb.update
      .collection('ideaBox__containers')
      .id(id)
      .data({
        ...body,
        ...(await getMedia('cover', cover))
      })
      .execute()
  )

const remove = forgeController
  .mutation()
  .description({
    en: 'Delete a container',
    ms: 'Padam bekas',
    'zh-CN': '删除容器',
    'zh-TW': '刪除容器'
  })
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'ideaBox__containers'
  })
  .statusCode(204)
  .callback(async ({ pb, query: { id } }) =>
    pb.delete.collection('ideaBox__containers').id(id).execute()
  )

const togglePin = forgeController
  .mutation()
  .description({
    en: 'Toggle pin status of a container',
    ms: 'Togol status pin bekas',
    'zh-CN': '切换容器的置顶状态',
    'zh-TW': '切換容器的置頂狀態'
  })
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'ideaBox__containers'
  })
  .callback(async ({ pb, query: { id } }) => {
    const container = await pb.getOne
      .collection('ideaBox__containers')
      .id(id)
      .execute()

    return pb.update
      .collection('ideaBox__containers')
      .id(id)
      .data({
        pinned: !container.pinned
      })
      .execute()
  })

const toggleHide = forgeController
  .mutation()
  .description({
    en: 'Toggle visibility of a container',
    ms: 'Togol keterlihatan bekas',
    'zh-CN': '切换容器的可见性',
    'zh-TW': '切換容器的可見性'
  })
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .existenceCheck('query', {
    id: 'ideaBox__containers'
  })
  .callback(async ({ pb, query: { id } }) => {
    const container = await pb.getOne
      .collection('ideaBox__containers')
      .id(id)
      .execute()

    return pb.update
      .collection('ideaBox__containers')
      .id(id)
      .data({
        hidden: !container.hidden,
        pinned: false
      })
      .execute()
  })

export default forgeRouter({
  validate,
  list,
  create,
  update,
  remove,
  togglePin,
  toggleHide
})
