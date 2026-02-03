import { Dropbox, type DropboxAuth, DropboxResponseError, type files } from 'dropbox'
import httpStatus from 'http-status'
import { camelKeys } from 'js-convert-case'
import fetch from 'node-fetch'
import env from '@/config/server.env'
import { MAX_FETCH_DBX_RESOURCES } from '@/constants/limits'
import { DropboxClientType, type DropboxClientTypeValue } from '@/db/constants'
import { DropboxAuthClient } from '@/lib/dropbox/DropboxAuthClient'
import { type DropboxFileMetadata, DropboxFileMetadataSchema } from '@/lib/dropbox/type'

import { withRetry } from '@/lib/withRetry'
import { dropboxArgHeader } from '@/utils/header'

export class DropboxClient {
  protected readonly clientInstance: Dropbox
  private dbxAuthClient: DropboxAuthClient

  constructor(
    refreshToken: string,
    rootNamespaceId?: string | null,
    type?: DropboxClientTypeValue,
  ) {
    this.dbxAuthClient = new DropboxAuthClient()
    this.clientInstance = this.createDropboxClient(refreshToken, rootNamespaceId, type)
  }

  /**
   * Function returns the instance of Dropbox client after checking and refreshing (if required) the access token
   * @returns instance of Dropbox client
   * @function checkAndRefreshAccessToken() in-built function that gets a fresh access token. Refresh token never expires unless revoked manually.
   */
  createDropboxClient(
    refreshToken: string,
    rootNamespaceId?: string | null,
    type: DropboxClientTypeValue = DropboxClientType.ROOT,
  ): Dropbox {
    this.dbxAuthClient.refreshAccessToken(refreshToken)

    const options: { auth: DropboxAuth; pathRoot?: string } = {
      auth: this.dbxAuthClient.authInstance,
    }

    // If we have a root namespace, set the header
    if (rootNamespaceId) {
      options.pathRoot = JSON.stringify({
        '.tag': type,
        [type]: rootNamespaceId,
      })
    }

    return new Dropbox(options)
  }

  getDropboxClient(): Dropbox {
    return this.clientInstance
  }

  async _manualFetch(
    url: string,
    headers?: Record<string, string>,
    body?: NodeJS.ReadableStream | null,
    otherOptions?: Record<string, string>,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  ) {
    return await fetch(url, {
      method,
      headers,
      body,
      ...otherOptions,
    })
  }

  async _getAllFilesFolders(
    rootPath: string,
    recursive: boolean = false,
    fetchAll: boolean = false,
    limit: number = MAX_FETCH_DBX_RESOURCES,
  ) {
    console.info(
      'DropboxClient#getAllFilesFolders :: Fetching all files and folders. Root path: ',
      rootPath,
    )
    const newLimit = limit > MAX_FETCH_DBX_RESOURCES ? MAX_FETCH_DBX_RESOURCES : limit

    const entries: files.ListFolderResult['entries'] = []
    let filesFolders = await this.clientInstance.filesListFolder({
      path: rootPath,
      recursive,
      limit: newLimit,
      include_non_downloadable_files: false,
      include_media_info: false,
    })
    entries.push(...filesFolders.result.entries)

    while (filesFolders.result.has_more && (fetchAll || entries.length < newLimit)) {
      const cursor = filesFolders.result.cursor
      filesFolders = await this.clientInstance.filesListFolderContinue({
        cursor,
      })
      entries.push(...filesFolders.result.entries)
    }
    console.info('DropboxClient#getAllFilesFolders :: Total entries', entries.length)

    return entries
  }

  async _downloadFile(urlPath: string, filePath: string, rootNamespaceId: string) {
    const headers = {
      Authorization: `Bearer ${this.dbxAuthClient.authInstance.getAccessToken()}`,
      'Dropbox-API-Path-Root': dropboxArgHeader({
        '.tag': 'namespace_id',
        namespace_id: rootNamespaceId,
      }),
      'Dropbox-API-Arg': dropboxArgHeader({ path: filePath }),
    }
    const response = await this.manualFetch(`${env.DROPBOX_API_URL}${urlPath}`, headers)
    if (response.status !== httpStatus.OK)
      throw new DropboxResponseError(response.status, response.headers, {
        error_summary: 'DropboxClient#downloadFile. Failed to download file', // following the dropbox response error convention with snake case
      })
    return response.body
  }

  /**
   * Description: this function streams the file to Dropbox. @param body is the readable stream of the file.
   * For the stream to work we need to add the Content-Type: 'application/octet-stream' in the headers.
   */
  async _uploadFile(
    urlPath: string,
    filePath: string,
    body: NodeJS.ReadableStream | null,
    rootNamespaceId: string,
  ): Promise<DropboxFileMetadata> {
    const args = {
      path: filePath,
      autorename: false,
      mode: 'add',
    }

    const headers = {
      Authorization: `Bearer ${this.dbxAuthClient.authInstance.getAccessToken()}`,
      'Dropbox-API-Path-Root': dropboxArgHeader({
        '.tag': 'namespace_id',
        namespace_id: rootNamespaceId,
      }),
      'Dropbox-API-Arg': dropboxArgHeader(args),
      'Content-Type': 'application/octet-stream',
    }
    const response = await this.manualFetch(`${env.DROPBOX_API_URL}${urlPath}`, headers, body)

    if (response.status !== httpStatus.OK)
      throw new DropboxResponseError(response.status, response.headers, {
        error_summary: 'DropboxClient#uploadFile. Failed to upload file', // following the dropbox response error convention with snake case
      })
    return DropboxFileMetadataSchema.parse(camelKeys(await response.json()))
  }

  private wrapWithRetry<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>,
  ): (...args: Args) => Promise<R> {
    return (...args: Args): Promise<R> =>
      withRetry(fn.bind(this), args, {
        minTimeout: 3000,
        // After a facter 2 exponential backoff [minTimeout * factor^(attemptNumber - 1)] timeout after 3 retries is 12 secs
        maxTimeout: 12000,
      })
  }

  manualFetch = this.wrapWithRetry(this._manualFetch)
  getAllFilesFolders = this.wrapWithRetry(this._getAllFilesFolders)
  downloadFile = this.wrapWithRetry(this._downloadFile)
  uploadFile = this.wrapWithRetry(this._uploadFile)
}
