import { z } from 'zod'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import CopilotConnectionError from '@/lib/copilot/errors/CopilotConnectionError'
import CopilotInvalidTokenError from '@/lib/copilot/errors/CopilotInvalidTokenError'
import CopilotNoTokenError from '@/lib/copilot/errors/CopilotNoTokenError'
import type { Token } from '@/lib/copilot/types'
import logger from '@/lib/logger'

class User {
  internalUserId?: string
  readonly portalId: string
  readonly copilot: CopilotAPI

  constructor(
    public readonly token: string,
    tokenPayload: Token,
    copilot?: CopilotAPI,
  ) {
    this.internalUserId = tokenPayload.internalUserId
    this.portalId = tokenPayload.workspaceId
    this.copilot = copilot || new CopilotAPI(token)
  }

  /**
   * Authenticates a Copilot user by token
   * @param token
   * @returns User instance modeled from the token payload
   * @throws CopilotNoTokenError when no token is provided
   * @throws CopilotInvalidTokenError when the token is invalid
   * @throws CopilotConnectionError when unable to connect to Copilot API
   */
  static async authenticate(token?: unknown): Promise<User> {
    if (!token) {
      throw new CopilotNoTokenError()
    }

    const tokenParsed = z.string().min(1).safeParse(token)

    if (!tokenParsed.success) {
      logger.info('User#authenticate :: Token parse error', tokenParsed.error)
      throw new CopilotInvalidTokenError()
    }

    let copilot: CopilotAPI
    try {
      copilot = new CopilotAPI(tokenParsed.data)
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unable to authorize Copilot SDK')) {
        throw new CopilotInvalidTokenError('Unable to authorize Copilot with provided token')
      }
      logger.error('User#authenticate :: Error while initializing Copilot client', err)
      throw new CopilotConnectionError()
    }

    const tokenPayload = await copilot.getTokenPayload()
    if (!tokenPayload) {
      throw new CopilotInvalidTokenError('Unable to decode Copilot token payload')
    }

    return new User(tokenParsed.data, tokenPayload, copilot)
  }
}

export default User
