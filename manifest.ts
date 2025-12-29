import { lazy } from 'react'
import type { ModuleConfig } from 'shared'

export default {
  name: 'Idea Box',
  icon: 'tabler:bulb',
  routes: {
    '/': lazy(() => import('@/pages/Containers')),
    '/:id/*': lazy(() => import('@/pages/Ideas'))
  },
  category: 'Productivity'
} satisfies ModuleConfig
