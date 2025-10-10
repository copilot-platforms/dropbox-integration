import status from 'http-status'
import { baseServerErrorFactory } from '@/errors/BaseServerError'

/**
 * Raised when token provided to server component / action / API route cannot be decrypted / has invalid payload
 */
const CopilotInvalidTokenError = baseServerErrorFactory(
  'CopilotInvalidTokenError',
  'Token is invalid',
  status.UNAUTHORIZED,
)

export default CopilotInvalidTokenError
