import {
  Button,
  ContextMenuItem,
  EmptyStateScreen,
  FAB,
  ModuleHeader,
  SearchInput,
  WithQueryData
} from 'lifeforge-ui'
import { useModalStore } from 'lifeforge-ui'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import forgeAPI from '@/utils/forgeAPI'

import '../../index.css'
import ContainerList from './components/ContainerList'
import ModifyContainerModal from './components/ModifyContainerModal'

function IdeaBox() {
  const { open } = useModalStore()

  const { t } = useTranslation('apps.ideaBox')

  const [searchQuery, setSearchQuery] = useState('')

  const [showhidden, setShowhidden] = useState(false)

  const handleCreateContainer = useCallback(() => {
    open(ModifyContainerModal, {
      type: 'create'
    })
  }, [])

  return (
    <>
      <ModuleHeader
        actionButton={
          <Button
            className="ml-4 hidden md:flex"
            icon="tabler:plus"
            tProps={{
              item: t('items.container')
            }}
            onClick={handleCreateContainer}
          >
            new
          </Button>
        }
        contextMenuProps={{
          children: (
            <>
              <ContextMenuItem
                icon="tabler:eye-off"
                label={showhidden ? 'Hide Hidden' : 'Show Hidden'}
                namespace="apps.ideaBox"
                onClick={() => setShowhidden(prev => !prev)}
              />
            </>
          )
        }}
      />
      <SearchInput
        debounceMs={300}
        namespace="apps.ideaBox"
        searchTarget="container"
        value={searchQuery}
        onChange={setSearchQuery}
      />
      <WithQueryData
        controller={forgeAPI.containers.list.input({
          hidden: showhidden.toString()
        })}
      >
        {data => {
          if (data.length === 0) {
            return (
              <EmptyStateScreen
                icon="tabler:cube-off"
                message={{
                  id: 'container',
                  namespace: 'apps.ideaBox'
                }}
              />
            )
          }

          const filteredList = data.filter(container =>
            container.name.toLowerCase().includes(searchQuery.toLowerCase())
          )

          if (filteredList.length === 0) {
            return (
              <EmptyStateScreen
                icon="tabler:search-off"
                message={{
                  id: 'containerSearch',
                  namespace: 'apps.ideaBox'
                }}
              />
            )
          }

          return <ContainerList filteredList={filteredList} />
        }}
      </WithQueryData>
      <FAB visibilityBreakpoint="md" onClick={handleCreateContainer} />
    </>
  )
}

export default IdeaBox
