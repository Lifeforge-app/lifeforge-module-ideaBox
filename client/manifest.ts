import { lazy } from 'react'

import { createForgeModuleClient } from '@lifeforge/federation'

import contract from './contract'

const { forgeAPI, ...manifest } = createForgeModuleClient({
  routes: {
    '/': lazy(() => import('@/pages/Containers')),
    '/:id/*': lazy(() => import('@/pages/Ideas'))
  },
  contract
})

export default manifest

export { forgeAPI }
