export interface StatusableError extends Error {
  status: number
}

/**
 * Base error class for Server components / actions / API routes
 */
export class BaseServerError extends Error {
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
