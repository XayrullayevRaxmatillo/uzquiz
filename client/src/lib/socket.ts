import { io, type Socket } from 'socket.io-client'

/** One authenticated socket per page session. The session cookie is sent automatically (withCredentials). */
export function createGameSocket(): Socket {
  return io(import.meta.env.VITE_SOCKET_URL || undefined, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  })
}

export function emitAck<T extends { ok: boolean }>(socket: Socket, event: string, payload?: unknown, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, code: 'NETWORK' } as unknown as T), timeoutMs)
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer)
      resolve(res)
    })
  })
}
