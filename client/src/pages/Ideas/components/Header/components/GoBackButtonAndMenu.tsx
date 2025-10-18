import { useIdeaBoxContext } from '@/providers/IdeaBoxProvider'
import { ContextMenu, ContextMenuItem, GoBackButton } from 'lifeforge-ui'
import { memo, useCallback } from 'react'
import { useLocation, useNavigate } from 'shared'

function GoBackButtonAndMenu() {
  const navigate = useNavigate()

  const location = useLocation()

  const { viewArchived, setViewArchived, setSearchQuery, setSelectedTags } =
    useIdeaBoxContext()

  const handleGoBack = useCallback(() => {
    if (viewArchived) {
      setViewArchived(false)
    }
    setSearchQuery('')
    setSelectedTags([])
    navigate(location.pathname.split('/').slice(0, -1).join('/'))
  }, [viewArchived, location.pathname, navigate])

  const handleViewArchive = useCallback(() => {
    setViewArchived(prev => !prev)
    setSearchQuery('')
    setSelectedTags([])
  }, [])

  return (
    <div className="flex-between w-full">
      <GoBackButton onClick={handleGoBack} />
      <ContextMenu>
        <ContextMenuItem
          icon={viewArchived ? 'tabler:archive-off' : 'tabler:archive'}
          label={viewArchived ? 'View Active' : 'View Archived'}
          namespace="apps.ideaBox"
          onClick={handleViewArchive}
        />
      </ContextMenu>
    </div>
  )
}

export default memo(GoBackButtonAndMenu)
