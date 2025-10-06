import { useIdeaBoxContext } from '@/providers/IdeaBoxProvider'
import { Icon } from '@iconify/react'
import clsx from 'clsx'
import { memo, useMemo } from 'react'
import tinycolor from 'tinycolor2'

function TagChip({ text }: { text: string }) {
  const { selectedTags, tagsQuery } = useIdeaBoxContext()

  const tags = tagsQuery.data ?? []

  const metadata = useMemo(
    () =>
      typeof tags !== 'string'
        ? tags.find(tag => tag.name === text)
        : undefined,
    [selectedTags, text, tags]
  )

  const active = useMemo(
    () => selectedTags.includes(text),
    [selectedTags, text, tags]
  )

  const tagColor = useMemo(() => {
    if (!active) {
      return 'bg-bg-200 text-bg-500 dark:bg-bg-700/50 dark:text-bg-300'
    }

    if (metadata === undefined || metadata.color === '') {
      return 'bg-custom-500/30 text-custom-500'
    }

    return tinycolor(metadata.color).isLight() ? 'text-bg-800' : 'text-bg-100'
  }, [active, metadata])

  return (
    <div
      className={clsx(
        'flex items-center rounded-full px-3 py-1 text-sm shadow-xs',
        tagColor
      )}
      style={{
        backgroundColor: metadata !== undefined && active ? metadata.color : ''
      }}
    >
      {metadata !== undefined && (
        <Icon
          key={metadata.icon}
          className="mr-2 size-3 shrink-0"
          icon={metadata.icon}
          style={{
            color: !active ? metadata.color : ''
          }}
        />
      )}
      <span className="shrink-0 text-sm">{text}</span>
    </div>
  )
}

export default memo(TagChip, (prevProps, nextProps) => {
  return prevProps.text === nextProps.text
})
