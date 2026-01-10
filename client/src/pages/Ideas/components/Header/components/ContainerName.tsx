import { Icon } from '@iconify/react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'shared'

import { useIdeaBoxContext } from '@/providers/IdeaBoxProvider'

function ContainerName({
  id,
  name,
  icon,
  color
}: {
  id: string
  name: string
  icon: string
  color: string
}) {
  const { t } = useTranslation('apps.ideaBox')

  const { setSelectedTags, setSearchQuery, viewArchived } = useIdeaBoxContext()

  const handleNavigateToRoot = useCallback(() => {
    setSelectedTags([])
    setSearchQuery('')
  }, [])

  return (
    <Link
      className="flex items-center gap-3"
      to={`/idea-box/${id}`}
      onClick={handleNavigateToRoot}
    >
      <div
        className="rounded-lg border-2 p-3"
        style={{
          backgroundColor: color + '20',
          borderColor: color
        }}
      >
        <Icon
          className="text-2xl sm:text-3xl"
          icon={icon}
          style={{
            color: color
          }}
        />
      </div>
      {viewArchived ? t('archivedIdeaIn', { container: name }) : ''}
    </Link>
  )
}

export default ContainerName
