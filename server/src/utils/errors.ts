export class AppError extends Error {
  status: number
  code: string
  fields?: Record<string, string>
  constructor(status: number, code: string, message?: string, fields?: Record<string, string>) {
    super(message ?? code)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const badRequest = (code = 'BAD_REQUEST', message?: string, fields?: Record<string, string>) => new AppError(400, code, message, fields)
export const unauthorized = (code = 'UNAUTHENTICATED', message?: string) => new AppError(401, code, message)
export const forbidden = (code = 'FORBIDDEN', message?: string) => new AppError(403, code, message)
export const notFound = (code = 'NOT_FOUND', message?: string) => new AppError(404, code, message)
export const conflict = (code = 'CONFLICT', message?: string, fields?: Record<string, string>) => new AppError(409, code, message, fields)
