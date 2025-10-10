import { BaseServerError } from '@/errors/BaseServerError'

class APIError extends BaseServerError {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly error?: unknown,
  ) {
    super(message, status)
    this.name = 'APIError'
  }
}

export default APIError
