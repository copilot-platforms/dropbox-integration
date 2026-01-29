import { Dropbox, type DropboxAuth, type files } from 'dropbox'
import { MAX_FETCH_DBX_RESOURCES } from '@/constants/limits'
import { DropboxClientType, type DropboxClientTypeValue } from '@/db/constants'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'
import { withRetry } from '@/lib/withRetry'

export class DropboxClient {
  protected clientInstance: Dropbox
  private dropboxApi: DropboxApi

  constructor(
    refreshToken: string,
    rootNamespaceId?: string | null,
    type?: DropboxClientTypeValue,
  ) {
    this.dropboxApi = new DropboxApi()
    this.clientInstance = this.getDropboxClient(refreshToken, rootNamespaceId, type)
  }

  /**
   * Function returns the instance of Dropbox client after checking and refreshing (if required) the access token
   * @returns instance of Dropbox client
   * @function checkAndRefreshAccessToken() in-built function that gets a fresh access token. Refresh token never expires unless revoked manually.
   */
  getDropboxClient(
    refreshToken: string,
    rootNamespaceId?: string | null,
    type: DropboxClientTypeValue = DropboxClientType.ROOT,
  ): Dropbox {
    this.dropboxApi.refreshAccessToken(refreshToken)

    const options: { auth: DropboxAuth; pathRoot?: string } = { auth: this.dropboxApi.dropboxAuth }

    // If we have a root namespace, set the header
    if (rootNamespaceId) {
      options.pathRoot = JSON.stringify({
        '.tag': type,
        [type]: rootNamespaceId,
      })
    }

    return new Dropbox(options)
  }

  async _getAllFilesFolders(
    rootPath: string,
    recursive: boolean = false,
    fetchAll: boolean = false,
  ) {
    console.info(
      'DropboxClient#getAllFilesFolders :: Fetching all files and folders. Root path: ',
      rootPath,
    )
    const entries: files.ListFolderResult['entries'] = []
    let filesFolders = await this.clientInstance.filesListFolder({
      path: rootPath,
      recursive,
      limit: MAX_FETCH_DBX_RESOURCES,
      include_non_downloadable_files: false,
      include_media_info: false,
    })
    entries.push(...filesFolders.result.entries)

    while (fetchAll && filesFolders.result.has_more) {
      const cursor = filesFolders.result.cursor
      filesFolders = await this.clientInstance.filesListFolderContinue({
        cursor,
      })
      entries.push(...filesFolders.result.entries)
    }
    console.info('DropboxClient#getAllFilesFolders :: Total entries', entries.length)

    return entries
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

  getAllFilesFolders = this.wrapWithRetry(this._getAllFilesFolders)
}
