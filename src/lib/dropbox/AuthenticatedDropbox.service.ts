import 'server-only'

import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import type User from '@/lib/copilot/models/User.model'
import BaseService from '@/lib/copilot/services/base.service'
import { DropboxApi } from '@/lib/dropbox/DropboxApi'
import { DropboxClient } from '@/lib/dropbox/DropboxClient'

class AuthenticatedDropboxService extends BaseService {
  protected dbxApi: DropboxApi
  protected dbxClient: DropboxClient
  protected readonly connectionToken: DropboxConnectionTokens

  constructor(user: User, connectionToken: DropboxConnectionTokens) {
    super(user)
    this.dbxApi = new DropboxApi()
    this.dbxClient = new DropboxClient(
      connectionToken.refreshToken,
      connectionToken.rootNamespaceId,
    )
    this.connectionToken = connectionToken
  }
}

export default AuthenticatedDropboxService
