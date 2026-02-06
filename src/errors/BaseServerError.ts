export interface StatusableError extends Error {
  status: number
}

export interface CopilotApiError extends Error {
  status: number
  body?: {
    message: string
  }
}

/**
 * Base error class for Server components / actions / API routes
 */
export class BaseServerError extends Error {
  public retryAfter?: number
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'BaseServerError'
  }
}

export const baseServerErrorFactory = (name: string, message: string, statusCode: number) => {
  return class extends BaseServerError {
    constructor(messageOverride?: string) {
      super(messageOverride || message, statusCode)
      this.name = name
    }
  }
}
