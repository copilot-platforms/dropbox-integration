import { DropboxAuth } from 'dropbox'
import { camelKeys } from 'js-convert-case'
import fetch from 'node-fetch'
import env from '@/config/server.env'
import { DropboxAuthResponseSchema, type DropboxAuthResponseType } from '@/lib/dropbox/type'
import { withRetry } from '@/lib/withRetry'

export class DropboxAuthClient {
  readonly authInstance: DropboxAuth

  constructor() {
    this.authInstance = this.initializeDropboxAuth()
  }

  private initializeDropboxAuth() {
    return new DropboxAuth({
      fetch,
      clientId: env.DROPBOX_APP_KEY,
      clientSecret: env.DROPBOX_APP_SECRET,
    })
  }

  refreshAccessToken(refreshToken: string) {
    this.authInstance.setRefreshToken(refreshToken)
    this.authInstance.checkAndRefreshAccessToken()
  }

  async _getAuthUrl(state: string) {
    return await this.authInstance.getAuthenticationUrl(
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

    const tokenSet = await this.authInstance.getAccessTokenFromCode(
      env.DROPBOX_REDIRECT_URI,
      code as string,
    )
    return DropboxAuthResponseSchema.parse(camelKeys(tokenSet.result))
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

  getAuthUrl = this.wrapWithRetry(this._getAuthUrl)
  handleDropboxCallback = this.wrapWithRetry(this._handleDropboxCallback)
}
