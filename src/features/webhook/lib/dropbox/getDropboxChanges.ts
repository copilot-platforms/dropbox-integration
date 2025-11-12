import { DropboxApi } from '@/lib/dropbox/DropboxApi'

export interface DropboxChange {
  type: 'file' | 'folder' | 'deleted'
  path: string
  id?: string
  serverModified?: string
}

export async function getDropboxChanges(
  accessToken: string,
  cursor: string,
  rootPath: string,
): Promise<{ changes: DropboxChange[]; newCursor: string; hasMore: boolean }> {
  const dbxApi = new DropboxApi()
  const dbx = dbxApi.getDropboxClient(accessToken)

  try {
    const response = await dbx.filesListFolderContinue({ cursor })

    const changes: DropboxChange[] = response.result.entries
      .filter((entry) => entry.path_lower?.startsWith(rootPath.toLowerCase()))
      .map((entry) => {
        if (entry['.tag'] === 'deleted') {
          return {
            type: 'deleted',
            path: entry.path_lower || '',
          }
        } else if (entry['.tag'] === 'file') {
          return {
            type: 'file',
            path: entry.path_lower || '',
            id: entry.id,
            serverModified: entry.server_modified,
          }
        } else {
          return {
            type: 'folder',
            path: entry.path_lower || '',
            id: entry.id,
          }
        }
      })

    return {
      changes,
      newCursor: response.result.cursor,
      hasMore: response.result.has_more,
    }
  } catch (error) {
    console.error('Error fetching Dropbox changes:', error)
    throw error
  }
}
