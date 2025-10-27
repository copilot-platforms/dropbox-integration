import 'server-only'

import type { DropboxConnectionTokens } from '@/db/schema/dropboxConnections.schema'
import type User from '@/lib/copilot/models/User.model'
import BaseService from '@/lib/copilot/services/base.service'
import { DropboxApi } from './DropboxApi'

class AuthenticatedDropboxService extends BaseService {
  protected dbxApi: DropboxApi
  protected readonly connectionToken: DropboxConnectionTokens

  constructor(user: User, connectionToken: DropboxConnectionTokens) {
    super(user)
    this.dbxApi = new DropboxApi()
    this.connectionToken = connectionToken
  }
}

export default AuthenticatedDropboxService
