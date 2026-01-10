import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmationModal, ContextMenu, ContextMenuItem } from 'lifeforge-ui'
import { useModalStore } from 'lifeforge-ui'
import { useCallback } from 'react'
import { toast } from 'react-toastify'
import { useParams } from 'shared'

import {
  type IdeaBoxIdea,
  useIdeaBoxContext
} from '@/providers/IdeaBoxProvider'
import forgeAPI from '@/utils/forgeAPI'

import ModifyIdeaModal from '../../../../modals/ModifyIdeaModal'
import MoveToFolderModal from '../../../../modals/MoveToFolderModal'

function EntryContextMenu({ entry }: { entry: IdeaBoxIdea }) {
  const { open } = useModalStore()

  const { viewArchived, searchQuery, selectedTags } = useIdeaBoxContext()

  const queryClient = useQueryClient()

  const { id, '*': path } = useParams<{ id: string; '*': string }>()

  const deleteMutation = useMutation(
    forgeAPI.ideaBox.ideas.remove
      .input({
        id: entry.id
      })
      .mutationOptions({
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['ideaBox', 'ideas']
          })
          queryClient.invalidateQueries({
            queryKey: ['ideaBox', 'misc', 'search']
          })
        },
        onError: () => {
          toast.error('Failed to delete idea')
        }
      })
  )

  const pinIdeaMutation = useMutation(
    forgeAPI.ideaBox.ideas.pin
      .input({
        id: entry.id
      })
      .mutationOptions({
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['ideaBox', 'ideas']
          })
          queryClient.invalidateQueries({
            queryKey: ['ideaBox', 'misc', 'search']
          })
        },
        onError: () => {
          toast.error(`Failed to ${entry.pinned ? 'unpin' : 'pin'} idea`)
        }
      })
  )

  const archiveIdeaMutation = useMutation(
    forgeAPI.ideaBox.ideas.archive
      .input({
        id: entry.id
      })
      .mutationOptions({
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['ideaBox', 'ideas']
          })
          queryClient.invalidateQueries({
            queryKey: ['ideaBox', 'misc', 'search']
          })
        },
        onError: () => {
          toast.error(
            `Failed to ${entry.archived ? 'unarchive' : 'archive'} idea`
          )
        }
      })
  )

  const removeFromFolderMutation = useMutation(
    forgeAPI.ideaBox.ideas.removeFromParent
      .input({
        id: entry.id
      })
      .mutationOptions({
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['ideaBox', 'ideas']
          })
          queryClient.invalidateQueries({
            queryKey: ['ideaBox', 'misc', 'search']
          })
        },
        onError: () => {
          toast.error('Failed to remove idea from folder')
        }
      })
  )

  const handleUpdateIdea = useCallback(() => {
    open(ModifyIdeaModal, {
      type: 'update',
      initialData: entry
    })
  }, [entry])

  const handleMoveToFolder = useCallback(() => {
    open(MoveToFolderModal, {
      idea: entry
    })
  }, [entry])

  const handleDeleteIdea = useCallback(() => {
    open(ConfirmationModal, {
      title: 'Delete Idea',
      description: `Are you sure you want to delete this idea? This action cannot be undone.`,
      confirmationButton: 'delete',
      onConfirm: async () => {
        await deleteMutation.mutateAsync({})
      }
    })
  }, [entry, id, path, viewArchived, searchQuery, selectedTags])

  return (
    <ContextMenu classNames={{ button: 'w-10 h-10' }}>
      {!entry.archived && (
        <ContextMenuItem
          icon={entry.pinned ? 'tabler:pinned-off' : 'tabler:pin'}
          label={entry.pinned ? 'Unpin' : 'Pin'}
          onClick={() => {
            pinIdeaMutation.mutate({})
          }}
        />
      )}
      <ContextMenuItem
        icon={entry.archived ? 'tabler:archive-off' : 'tabler:archive'}
        label={entry.archived ? 'Unarchive' : 'Archive'}
        onClick={() => {
          archiveIdeaMutation.mutate({})
        }}
      />
      <ContextMenuItem
        icon="tabler:pencil"
        label="Edit"
        onClick={handleUpdateIdea}
      />
      <ContextMenuItem
        icon="tabler:folder-symlink"
        label="Move to Folder"
        namespace="apps.ideaBox"
        onClick={handleMoveToFolder}
      />
      {!searchQuery && selectedTags.length === 0 && path !== '' && (
        <ContextMenuItem
          icon="tabler:folder-minus"
          label="Remove from folder"
          namespace="apps.ideaBox"
          onClick={() => {
            removeFromFolderMutation.mutate({})
          }}
        />
      )}
      <ContextMenuItem
        dangerous
        icon="tabler:trash"
        label="Delete"
        onClick={handleDeleteIdea}
      />
    </ContextMenu>
  )
}

export default EntryContextMenu
