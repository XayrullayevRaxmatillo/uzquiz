import { createHash, randomBytes } from 'node:crypto'

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('hex')
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I confusion
export function randomCode(len = 6): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length]
  return out
}
