import type { ApiEnvelope } from './types'

export class ApiError extends Error {
  code: string
  status: number
  fields?: Record<string, string>
  constructor(code: string, message: string, status: number, fields?: Record<string, string>) {
    super(message)
    this.code = code
    this.status = status
    this.fields = fields
  }
}

const BASE = import.meta.env.VITE_API_URL || '/api'

/** CSRF token handed out by the server on login/register/me. Kept in memory only. */
let csrfToken: string | null = null
export function setCsrfToken(token: string | null) {
  csrfToken = token
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function api<T>(path: string, opts: { method?: Method; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('NETWORK', 'Network error', 0)
  }

  let json: ApiEnvelope<T> | null = null
  try {
    json = (await res.json()) as ApiEnvelope<T>
  } catch {
    /* non-JSON body */
  }

  if (!res.ok || !json?.success) {
    const err = json?.error
    throw new ApiError(err?.code ?? 'UNKNOWN', err?.message ?? res.statusText, res.status, err?.fields)
  }
  return json.data as T
}

/** Map backend error codes to translation keys. */
export const ERROR_KEYS = {
  NETWORK: 'common.errorNetwork',
  EMAIL_TAKEN: 'auth.emailTaken',
  USERNAME_TAKEN: 'auth.usernameTaken',
  INVALID_CREDENTIALS: 'auth.invalidCredentials',
  RATE_LIMITED: 'auth.tooManyAttempts',
  UNAUTHENTICATED: 'auth.sessionExpired',
} as const
