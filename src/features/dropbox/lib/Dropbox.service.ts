import type { files } from 'dropbox'
import httpStatus from 'http-status'
import { MAX_FETCH_DBX_RESOURCES } from '@/constants/limits'
import { ObjectType } from '@/db/constants'
import APIError from '@/errors/APIError'
import type { Folder } from '@/features/sync/types'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'

export class DropboxService extends AuthenticatedDropboxService {
  async getFolderTree() {
    this.dbxApi.refreshAccessToken(this.connectionToken.refreshToken)
    const dbxClient = this.dbxApi.getDropboxClient(this.connectionToken.refreshToken)
    let dbxResponse = await dbxClient.filesListFolder({
      path: '',
      recursive: true,
      limit: MAX_FETCH_DBX_RESOURCES,
    })
    let entries = dbxResponse.result.entries
    if (dbxResponse.status !== httpStatus.OK) {
      throw new APIError('Cannot fetch the folders', dbxResponse.status)
    }

    while (dbxResponse.result.has_more) {
      dbxResponse = await dbxClient.filesListFolderContinue({ cursor: dbxResponse.result.cursor })
      entries = entries.concat(dbxResponse.result.entries)
    }

    return this.buildFolderTree(entries)
  }

  private buildFolderTree(entries: files.ListFolderResult['entries']) {
    const root: Folder[] = []

    const findOrCreate = (children: Folder[], path: string, label: string) => {
      let node = children.find((c) => c.path === path)
      if (!node) {
        node = { path, label, children: [] }
        children.push(node)
      }
      return node
    }

    for (const item of entries) {
      if (item['.tag'] === ObjectType.FOLDER) {
        const parts = item.path_display?.split('/').filter(Boolean)
        let currentChildren: Folder[] = root
        let currentPath = ''

        if (!parts || parts.length === 0) continue

        for (const part of parts) {
          currentPath += `/${part}`
          const label = part
          const node = findOrCreate(currentChildren, currentPath, label)
          currentChildren = node?.children ?? []
        }
      }
    }

    return root
  }
}
