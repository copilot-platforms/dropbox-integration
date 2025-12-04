import { Dropbox, DropboxAuth } from 'dropbox'
import httpStatus from 'http-status'
import { camelKeys } from 'js-convert-case'
import fetch from 'node-fetch'
import env from '@/config/server.env'
import {
  DropboxAuthResponseSchema,
  type DropboxAuthResponseType,
  type DropboxFileMetadata,
  DropboxFileMetadataSchema,
} from '@/lib/dropbox/type'
import { withRetry } from '@/lib/withRetry'
import { dropboxArgHeader } from '@/utils/header'

export class DropboxApi {
  private readonly dropboxAuth: DropboxAuth

  constructor() {
    this.dropboxAuth = this.initializeDropboxAuth()
  }

  private initializeDropboxAuth() {
    return new DropboxAuth({
      fetch,
      clientId: env.DROPBOX_APP_KEY,
      clientSecret: env.DROPBOX_APP_SECRET,
    })
  }

  refreshAccessToken(refreshToken: string) {
    this.dropboxAuth.setRefreshToken(refreshToken)
    this.dropboxAuth.checkAndRefreshAccessToken()
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

  /**
   * Function returns the instance of Dropbox client after checking and refreshing (if required) the access token
   * @returns instance of Dropbox client
   * @function checkAndRefreshAccessToken() in-built function that gets a fresh access token. Refresh token never expires unless revoked manually.
   */
  getDropboxClient(refreshToken: string, rootNamespaceId?: string | null): Dropbox {
    this.refreshAccessToken(refreshToken)
    
    const options: any = { auth: this.dropboxAuth }
    
    // If we have a root namespace, set the header
    if (rootNamespaceId) {
      options.pathRoot = JSON.stringify({
        '.tag': 'root',
        root: rootNamespaceId,
      })
    }

    return new Dropbox(options)
  }

  async _getAuthUrl(state: string) {
    return await this.dropboxAuth.getAuthenticationUrl(
      env.DROPBOX_REDIRECT_URI,
      state,
      'code',
      'offline', // token access type: offline returns a refresh token
      env.DROPBOX_SCOPES.split(' '),
      'none',
      false,
    )
  }

  async _handleDropboxCallback(
    urlParams: Record<string, string | string[] | undefined>,
  ): Promise<DropboxAuthResponseType> {
    const code = urlParams.code
    if (!code) {
      throw new Error('No code provided in Dropbox callback')
    }

    const tokenSet = await this.dropboxAuth.getAccessTokenFromCode(
      env.DROPBOX_REDIRECT_URI,
      code as string,
    )
    return DropboxAuthResponseSchema.parse(camelKeys(tokenSet.result))
  }

  async _downloadFile(urlPath: string, filePath: string) {
    const headers = {
      Authorization: `Bearer ${this.dropboxAuth.getAccessToken()}`,
      'Dropbox-API-Arg': dropboxArgHeader({ path: filePath }),
    }
    const response = await this.manualFetch(`${env.DROPBOX_API_URL}${urlPath}`, headers)
    if (response.status !== httpStatus.OK)
      throw new Error('DropboxApi#downloadFile. Failed to download file')
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
  ): Promise<DropboxFileMetadata> {
    const args = {
      path: filePath,
      autorename: false,
      mode: 'add',
    }
    const headers = {
      Authorization: `Bearer ${this.dropboxAuth.getAccessToken()}`,
      'Dropbox-API-Arg': dropboxArgHeader(args),
      'Content-Type': 'application/octet-stream',
    }
    const response = await this.manualFetch(`${env.DROPBOX_API_URL}${urlPath}`, headers, body)
    if (response.status !== httpStatus.OK)
      throw new Error('DropboxApi#uploadFile. Failed to upload file')
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
  getAuthUrl = this.wrapWithRetry(this._getAuthUrl)
  handleDropboxCallback = this.wrapWithRetry(this._handleDropboxCallback)
  downloadFile = this.wrapWithRetry(this._downloadFile)
  uploadFile = this.wrapWithRetry(this._uploadFile)
}
