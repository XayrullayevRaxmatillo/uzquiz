import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createGameSocket, emitAck } from '../lib/socket'

export interface Participant { id: string; name: string; teamId: string | null; ready: boolean; connected: boolean; score: number }
export interface QuestionView { index: number; total: number; text: string; options: string[]; endsAt: number; serverNow: number; myChoice: number | null }
export interface RevealView {
  index: number; total: number; correctIndex: number; explanation: string; distribution: number[]
  players: Record<string, { answered: boolean; correct: boolean; points: number; choice: number | null }>
  leaderboard: { id: string; rank: number; score: number; correct: number }[]
  isLast: boolean
}
export interface RoomState {
  code: string
  status: 'lobby' | 'active' | 'paused' | 'ended'
  host: { id: string; name: string }
  quiz: { id: string; title: string; category: string; language: string; questionCount: number }
  teamMode: boolean
  settings: { maxPlayers: number; questionCount: number; timeLimit: number; visibility: 'public' | 'private'; speedBonus: number }
  participants: Participant[]
  me: { id: string; isHost: boolean }
  phase: 'lobby' | 'countdown' | 'question' | 'reveal' | 'paused' | 'ended'
  question: QuestionView | null
  reveal: RevealView | null
  paused: boolean
}
export interface EndedPayload {
  reason: 'completed' | 'host_ended' | 'abandoned'
  ranking: { id: string; name: string; teamId: string | null; rank: number; score: number; correct: number; total: number; accuracy: number; avgResponseMs: number }[]
  teams: { teamId: string; name: string; score: number; members: number; rank: number }[]
  winnerId: string | null
  total: number
  me: { xp: number; level: number; streak: number; achievements: string[] } | null
}

export type Conn = 'connecting' | 'online' | 'offline'
type Phase = RoomState['phase']

export function useRoom(code: string) {
  const [state, setState] = useState<RoomState | null>(null)
  const [phase, setPhase] = useState<Phase>('lobby')
  const [question, setQuestion] = useState<QuestionView | null>(null)
  const [reveal, setReveal] = useState<RevealView | null>(null)
  const [answerCount, setAnswerCount] = useState<{ answered: number; total: number }>({ answered: 0, total: 0 })
  const [myChoice, setMyChoice] = useState<number | null>(null)
  const [ended, setEnded] = useState<EndedPayload | null>(null)
  const [conn, setConn] = useState<Conn>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState<'kicked' | 'closed' | null>(null)
  const [startingMs, setStartingMs] = useState<number | null>(null)
  const [rematch, setRematch] = useState<string | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const socketRef = useRef<Socket | null>(null)

  const applyState = useCallback((s: RoomState) => {
    setState(s)
    setPhase(s.phase)
    setQuestion(s.question)
    setReveal(s.reveal)
    if (s.question) {
      setMyChoice(s.question.myChoice)
      setClockOffset(s.question.serverNow - Date.now())
    }
  }, [])

  useEffect(() => {
    const socket = createGameSocket()
    socketRef.current = socket

    const join = async () => {
      const res = await emitAck<{ ok: boolean; code?: string; state?: RoomState }>(socket, 'room:join', { code })
      if (res.ok && res.state) {
        setError(null)
        applyState(res.state)
        if (res.state.status === 'ended') setPhase('ended')
      } else setError(res.code ?? 'NETWORK')
    }

    socket.on('connect', () => { setConn('online'); void join() })
    socket.on('disconnect', () => setConn('offline'))
    socket.io.on('reconnect_attempt', () => setConn('connecting'))
    socket.on('connect_error', (e) => { setConn('offline'); if (e.message === 'UNAUTHENTICATED') setError('UNAUTHENTICATED') })

    socket.on('room:state', (s: RoomState) => applyState(s))
    socket.on('game:starting', (p: { inMs: number }) => { setStartingMs(p.inMs); setPhase('countdown'); setReveal(null); setQuestion(null) })
    socket.on('question:start', (q: Omit<QuestionView, 'myChoice'>) => {
      setClockOffset(q.serverNow - Date.now())
      setQuestion({ ...q, myChoice: null })
      setMyChoice(null)
      setReveal(null)
      setAnswerCount({ answered: 0, total: 0 })
      setPhase('question')
    })
    socket.on('answer:count', (c: { answered: number; total: number }) => setAnswerCount(c))
    socket.on('question:reveal', (r: RevealView) => { setReveal(r); setPhase('reveal') })
    socket.on('game:paused', () => setPhase('paused'))
    socket.on('game:resumed', (p: { phase: Phase; endsAt?: number; serverNow: number }) => {
      setClockOffset(p.serverNow - Date.now())
      if (p.endsAt) setQuestion((q) => (q ? { ...q, endsAt: p.endsAt! } : q))
      setPhase(p.phase)
    })
    socket.on('game:ended', (p: EndedPayload) => { setEnded(p); setPhase('ended') })
    socket.on('room:kicked', () => setFatal('kicked'))
    socket.on('room:closed', () => setFatal('closed'))
    socket.on('room:rematch', (p: { code: string }) => setRematch(p.code))

    return () => {
      socket.removeAllListeners()
      socket.close()
      socketRef.current = null
    }
  }, [code, applyState])

  const send = useCallback(async (event: string, payload?: unknown) => {
    const s = socketRef.current
    if (!s) return { ok: false, code: 'NETWORK' } as { ok: boolean; code?: string; [k: string]: unknown }
    return emitAck<{ ok: boolean; code?: string; [k: string]: unknown }>(s, event, payload)
  }, [])

  const answer = useCallback(async (choice: number) => {
    if (!question || myChoice !== null) return
    setMyChoice(choice) // optimistic; the server is the judge
    const r = await send('answer:submit', { questionIndex: question.index, choice })
    if (!r.ok) setMyChoice(null)
    return r
  }, [question, myChoice, send])

  return { state, phase, question, reveal, answerCount, myChoice, ended, conn, error, fatal, startingMs, rematch, clockOffset, send, answer }
}
