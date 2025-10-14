import { Dropbox, DropboxAuth } from 'dropbox'
import { camelKeys } from 'js-convert-case'
import env from '@/config/server.env'
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

  /**
   * Function returns the instance of Dropbox client after checking and refreshing (if required) the access token
   * @param refreshToken
   * @returns instance of Dropbox client
   * @function checkAndRefreshAccessToken() in-built function that gets a fresh access token. Refresh token never expires unless revoked manually.
   */
  getDropboxClient(refreshToken: string): Dropbox {
    this.dropboxAuth.setRefreshToken(refreshToken)
    this.dropboxAuth.checkAndRefreshAccessToken()
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
}
