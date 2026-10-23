import { ApiError } from './api'
import type { TKey } from '../i18n'
import type { Dict } from '../i18n/types'

type ErrorCode = Exclude<keyof Dict['errors'], 'generic'>
const KNOWN = new Set<string>([
  'FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'RATE_LIMITED', 'UNAUTHENTICATED', 'TEAM_FULL', 'ALREADY_IN_TEAM', 'TEAM_NAME_TAKEN', 'TEAM_NOT_FOUND',
  'TEAM_PRIVATE', 'INVITE_INVALID', 'REQUEST_EXISTS', 'NOT_STAFF', 'OWNER_ONLY', 'NOT_ALLOWED', 'ROOM_NOT_FOUND', 'ROOM_ENDED', 'ROOM_FULL',
  'GAME_IN_PROGRESS', 'KICKED', 'NEED_TEAM', 'NOT_HOST', 'QUIZ_NOT_FOUND', 'NOT_OWNER', 'PLAY_FIRST', 'TOKEN_INVALID', 'TOO_MANY_ROOMS',
  'ALREADY_REPORTED', 'GAME_NOT_FINISHED', 'NOT_PARTICIPANT',
] satisfies ErrorCode[])

/** Translate any error (ApiError, socket ack code or unknown) into a localized message key. */
export function errorKey(e: unknown): TKey {
  const code = e instanceof ApiError ? e.code : typeof e === 'string' ? e : ''
  if (code === 'NETWORK') return 'common.errorNetwork'
  if (code === 'INVALID_CREDENTIALS') return 'auth.invalidCredentials'
  if (code === 'EMAIL_TAKEN') return 'auth.emailTaken'
  if (code === 'USERNAME_TAKEN') return 'auth.usernameTaken'
  if (KNOWN.has(code)) return `errors.${code as ErrorCode}` as TKey
  return 'errors.generic'
}
