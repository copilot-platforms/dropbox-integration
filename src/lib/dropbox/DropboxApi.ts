import { Dropbox, DropboxAuth } from 'dropbox'
import { camelKeys } from 'js-convert-case'
import env from '@/config/server.env'
import { withRetry } from '../copilot/withRetry'
import { DropboxAuthResponseSchema, type DropboxAuthResponseType } from './type'

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

  async _manualFetch(url: string, headers?: Record<string, string>, body?: string) {
    return await fetch(url, {
      method: 'POST',
      headers,
      body,
    })
  }

  /**
   * Function returns the instance of Dropbox client after checking and refreshing (if required) the access token
   * @returns instance of Dropbox client
   * @function checkAndRefreshAccessToken() in-built function that gets a fresh access token. Refresh token never expires unless revoked manually.
   */
  getDropboxClient(refreshToken: string): Dropbox {
    this.refreshAccessToken(refreshToken)
    return new Dropbox({ auth: this.dropboxAuth })
  }

  async getAuthUrl(state: string) {
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

  async handleDropboxCallback(
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
      'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
    }
    const response = await this._manualFetch(`${env.DROPBOX_API_URL}${urlPath}`, headers)
    return await response.arrayBuffer()
  }

  private wrapWithRetry<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>,
  ): (...args: Args) => Promise<R> {
    return (...args: Args): Promise<R> => withRetry(fn.bind(this), args)
  }

  // Methods wrapped with retry
  manualFetch = this.wrapWithRetry(this._manualFetch)
  downloadFile = this.wrapWithRetry(this._downloadFile)
}
