import type { files } from 'dropbox'
import httpStatus from 'http-status'
import type { NextRequest } from 'next/server'
import { MAX_FETCH_DBX_RESOURCES, MAX_FETCH_DBX_SEARCH_LIMIT } from '@/constants/limits'
import { ObjectType } from '@/db/constants'
import APIError from '@/errors/APIError'
import { MapFilesService } from '@/features/sync/lib/MapFiles.service'
import type { Folder } from '@/features/sync/types'
import AuthenticatedDropboxService from '@/lib/dropbox/AuthenticatedDropbox.service'
import logger from '@/lib/logger'

export class DropboxService extends AuthenticatedDropboxService {
  async getFolderTree(req: NextRequest) {
    const search = req.nextUrl.searchParams.get('search')

    // Pass the rootNamespaceId from the connection token
    const dbxClient = this.dbxApi.getDropboxClient(
      this.connectionToken.refreshToken,
      this.connectionToken.rootNamespaceId,
    )

    if (search) {
      logger.info('DropboxService#getFolderTree :: Searching folder in Dropbox... Query: ', search)
      const searchResponse = await dbxClient.filesSearchV2({
        query: search,
        options: {
          max_results: MAX_FETCH_DBX_SEARCH_LIMIT,
        },
      })
      if (searchResponse.status !== httpStatus.OK) {
        throw new APIError('Cannot fetch the folders', searchResponse.status)
      }

      return await this.formatSearchResults(searchResponse.result.matches)
    }

    // Now this call will be rooted in the Team Space
    const dbxResponse = await dbxClient.filesListFolder({
      path: '', // "" is now the Team Space root, not the Member Folder
      recursive: false,
      limit: MAX_FETCH_DBX_RESOURCES,
      include_non_downloadable_files: false,
    })
    const entries = dbxResponse.result.entries || []

    if (dbxResponse.status !== httpStatus.OK) {
      throw new APIError('Cannot fetch the folders', dbxResponse.status)
    }

    logger.info('DropboxService#getFolderTree :: Fetched folder tree', entries)
    return await this.buildFolderTree(entries)
  }

  private async buildFolderTree(entries: files.ListFolderResult['entries']): Promise<Folder[]> {
    const root: Folder[] = []
    const mapService = new MapFilesService(this.user, this.connectionToken)
    const mapList = (await mapService.getAllChannelMaps()).map(
      (channelMap) => channelMap.dbxRootPath,
    )

    const findOrCreate = (children: Folder[], path: string, label: string) => {
      let node = children.find((c) => c.path === path)
      if (!node) {
        node = { path, label, children: [] }
        children.push(node)
      }
      return node
    }

    logger.info('DropboxService#buildFolderTree :: Building folder tree', entries)
    for (const item of entries) {
      if (item['.tag'] === ObjectType.FOLDER) {
        // below condition is to make sure the map is one-to-one
        if (!item.path_display || mapList.includes(item.path_display)) continue

        const parts = item.path_display.split('/').filter(Boolean)
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

    logger.info('DropboxService#buildFolderTree :: Built folder tree', root)
    return root
  }

  private async formatSearchResults(matches: files.SearchMatchV2[]) {
    const mapService = new MapFilesService(this.user, this.connectionToken)
    const mapList = (await mapService.getAllChannelMaps()).map(
      (channelMap) => channelMap.dbxRootPath,
    )

    return matches
      .map((match) => {
        if (match.metadata['.tag'] === 'other') return null

        const data = match.metadata.metadata
        if (data['.tag'] !== ObjectType.FOLDER) return null

        // below condition is to make sure the map is one-to-one
        if (!data.path_display || mapList.includes(data.path_display)) return null

        return {
          path: data.path_display,
          label: data.path_display,
          children: [],
        }
      })
      .filter((item) => item !== null)
  }
}
