import httpStatus from 'http-status'
import { z } from 'zod'
import APIError from '@/errors/APIError'
import { CopilotAPI } from '@/lib/copilot/CopilotAPI'
import CopilotConnectionError from '@/lib/copilot/errors/CopilotConnectionError'
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
   * @throws CopilotConnectionError when unable to connect to Copilot API
   */
  static async authenticate(token?: unknown): Promise<User> {
    logger.info('User#authenticate :: Authenticating user', token)

    if (!token) {
      throw new APIError('Please provide a valid token', httpStatus.UNAUTHORIZED)
    }

    const tokenParsed = z.string().min(1).safeParse(token)

    if (!tokenParsed.success) {
      logger.info('User#authenticate :: Token parse error', tokenParsed.error)
      throw new APIError('Token parse error', httpStatus.UNAUTHORIZED)
    }

    let copilot: CopilotAPI
    try {
      copilot = new CopilotAPI(tokenParsed.data)
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unable to authorize Copilot SDK')) {
        throw new APIError(
          'Unable to authorize Copilot with provided token',
          httpStatus.UNAUTHORIZED,
        )
      }
      logger.error('User#authenticate :: Error while initializing Copilot client', err)
      throw new CopilotConnectionError()
    }

    const tokenPayload = await copilot.getTokenPayload()
    if (!tokenPayload) {
      throw new APIError('Unable to decode Copilot token payload', httpStatus.UNAUTHORIZED)
    }

    return new User(tokenParsed.data, tokenPayload, copilot)
  }
}

export default User
