export interface StatusableError extends Error {
  status: number
  retryAfter?: number
}

/**
 * Base error class for Server components / actions / API routes
 */
export class BaseServerError extends Error {
  public retryAfter?: number
  constructor(
    message: string,
    public readonly statusCode: number,
    retryAfter?: number,
  ) {
    super(message)
    this.name = 'BaseServerError'
    this.retryAfter = retryAfter
  }
}

export const baseServerErrorFactory = (name: string, message: string, statusCode: number) => {
  return class extends BaseServerError {
    constructor(messageOverride?: string, retryAfter?: number) {
      super(messageOverride || message, statusCode, retryAfter)
      this.name = name
    }
  }
}
