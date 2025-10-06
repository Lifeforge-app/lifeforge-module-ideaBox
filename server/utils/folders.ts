import { PBService } from '@functions/database'

export const validateFolderPath = async (
  pb: PBService,
  container: string,
  path: string[]
): Promise<{ folderExists: boolean; lastFolder: string }> => {
  let folderExists = true
  let lastFolder = ''

  for (const folder of path) {
    if (!folder) continue

    try {
      const folderEntry = await pb.getOne
        .collection('idea_box__folders')
        .id(folder)
        .execute()

      if (
        folderEntry.parent !== lastFolder ||
        folderEntry.container !== container
      ) {
        folderExists = false
        break
      }

      lastFolder = folder
    } catch {
      folderExists = false
      break
    }
  }

  return { folderExists, lastFolder }
}

export async function recursivelySearchFolder(
  folderId: string,
  q: string,
  container: string,
  tags: string = '',
  parents: string,
  pb: PBService
) {
  const folderInsideFolder = await pb.getFullList
    .collection('idea_box__folders')
    .filter([
      {
        field: 'parent',
        operator: '=',
        value: folderId
      }
    ])
    .execute()

  const thisFolder = folderId
    ? await pb.getOne.collection('idea_box__folders').id(folderId).execute()
    : undefined

  const textResults = (
    await pb.getFullList
      .collection('idea_box__entries_text')
      .expand({ base_entry: 'idea_box__entries' })
      .filter([
        {
          field: 'content',
          operator: '~',
          value: q
        },
        {
          field: 'base_entry.container',
          operator: '=',
          value: container
        },
        {
          field: 'base_entry.archived',
          operator: '=',
          value: false
        },
        {
          field: 'base_entry.folder',
          operator: '=',
          value: folderId
        },
        ...(tags
          ? tags.split(',').map(
              tag =>
                ({
                  field: 'base_entry.tags',
                  operator: '~',
                  value: tag
                }) as const
            )
          : [])
      ])
      .execute()
  ).map(result => ({
    ...result.expand!.base_entry!,
    collectionId: result.collectionId,
    collectionName: result.collectionName,
    content: result.content,
    expand: {
      folder: thisFolder
    },
    type: 'text' as const,
    fullPath: parents
  }))

  if (folderInsideFolder.length === 0) {
    return textResults
  }

  for (const folder of folderInsideFolder) {
    const results = await recursivelySearchFolder(
      folder.id,
      q,
      container,
      tags,
      parents + '/' + folder.id,
      pb
    )

    textResults.push(...results)
  }

  return textResults
}
