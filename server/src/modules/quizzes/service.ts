import type { FilterQuery, Types } from 'mongoose'
import { Quiz, type QuizDoc } from '../../models/Quiz.js'
import { User, type UserDoc } from '../../models/User.js'
import { GameResult } from '../../models/GameResult.js'
import { Report } from '../../models/Misc.js'
import { badRequest, forbidden, notFound } from '../../utils/errors.js'
import type { QuizBody } from './schemas.js'
import { unlock } from '../stats/progress.js'

const sid = (v: unknown) => String(v)
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

type Lean = Awaited<ReturnType<typeof Quiz.find>>[number]

/** Public card/detail shape. NEVER includes correct answers. */
export function quizDto(q: QuizDoc | Lean, viewer?: UserDoc, extra: { creatorName?: string } = {}) {
  const creator = q.creator as unknown as { _id?: Types.ObjectId; name?: string; username?: string } | Types.ObjectId
  const creatorObj = creator && typeof creator === 'object' && 'name' in creator ? creator : null
  return {
    id: sid(q._id),
    title: q.title,
    description: q.description,
    category: q.category,
    language: q.language,
    difficulty: q.difficulty,
    coverImage: q.coverImage,
    visibility: q.visibility,
    questionCount: q.questions.length,
    totalSeconds: q.questions.reduce((n, x) => n + (x.timeLimit ?? 20), 0),
    ratingAvg: Math.round(q.ratingAvg * 10) / 10,
    ratingCount: q.ratingCount,
    playCount: q.playCount,
    favoritesCount: q.favoritesCount,
    isDemo: q.isSeed,
    creator: creatorObj ? { id: sid(creatorObj._id), name: creatorObj.name, username: creatorObj.username } : { id: sid(creator), name: extra.creatorName },
    isOwner: viewer ? sid(creatorObj?._id ?? creator) === sid(viewer._id) : false,
    isFavorite: viewer ? viewer.favorites.some((f) => sid(f) === sid(q._id)) : false,
    myRating: viewer ? q.ratings.find((r) => sid(r.user) === sid(viewer._id))?.value ?? null : null,
    createdAt: (q as unknown as { createdAt: Date }).createdAt,
  }
}

/** Owner/admin edit view — includes correct answers. */
export function quizEditDto(q: QuizDoc) {
  return {
    ...quizDto(q),
    questions: q.questions.map((x) => ({
      id: sid(x._id),
      text: x.text,
      options: x.options.map((o) => o.text),
      correctIndex: x.correctIndex,
      timeLimit: x.timeLimit,
      explanation: x.explanation,
    })),
  }
}

const toQuestions = (b: QuizBody) => b.questions.map((x) => ({ text: x.text, options: x.options.map((text) => ({ text })), correctIndex: x.correctIndex, timeLimit: x.timeLimit, explanation: x.explanation }))

function canManage(q: QuizDoc, user: UserDoc) {
  return sid(q.creator) === sid(user._id) || user.role === 'admin'
}
function canView(q: QuizDoc, user?: UserDoc) {
  if (q.status === 'hidden') return !!user && (sid(q.creator) === sid(user._id) || user.role !== 'user')
  return q.visibility === 'public' || (!!user && (sid(q.creator) === sid(user._id) || user.role === 'admin'))
}

export async function createQuiz(user: UserDoc, body: QuizBody) {
  const quiz = await Quiz.create({ ...body, questions: toQuestions(body), creator: user._id })
  void unlock(user._id, ['quiz_creator']).catch(() => undefined)
  return quizEditDto(quiz)
}

export async function updateQuiz(user: UserDoc, id: string, body: QuizBody) {
  const quiz = await Quiz.findById(id)
  if (!quiz) throw notFound('QUIZ_NOT_FOUND')
  if (!canManage(quiz, user)) throw forbidden('NOT_OWNER')
  quiz.set({ ...body, questions: toQuestions(body) })
  await quiz.save()
  return quizEditDto(quiz)
}

export async function deleteQuiz(user: UserDoc, id: string) {
  const quiz = await Quiz.findById(id)
  if (!quiz) throw notFound('QUIZ_NOT_FOUND')
  if (!canManage(quiz, user)) throw forbidden('NOT_OWNER')
  await quiz.deleteOne()
  await User.updateMany({ favorites: quiz._id }, { $pull: { favorites: quiz._id } })
  return { deleted: true }
}

export async function getQuiz(id: string, viewer?: UserDoc) {
  const quiz = await Quiz.findById(id).populate('creator', 'name username')
  if (!quiz || !canView(quiz, viewer)) throw notFound('QUIZ_NOT_FOUND')
  return quizDto(quiz, viewer)
}

export async function getQuizForEdit(id: string, user: UserDoc) {
  const quiz = await Quiz.findById(id)
  if (!quiz) throw notFound('QUIZ_NOT_FOUND')
  if (!canManage(quiz, user)) throw forbidden('NOT_OWNER')
  return quizEditDto(quiz)
}

export async function listQuizzes(
  f: { q?: string; category?: string; language?: string; difficulty?: string; sort: 'newest' | 'popular' | 'rating'; page: number; limit: number },
  viewer?: UserDoc,
  scope: { mine?: boolean; favorites?: boolean } = {},
) {
  const filter: FilterQuery<QuizDoc> = {}
  if (scope.mine && viewer) filter.creator = viewer._id
  else if (scope.favorites && viewer) {
    filter._id = { $in: viewer.favorites }
    filter.visibility = 'public'
    filter.status = 'active'
  } else {
    filter.visibility = 'public'
    filter.status = 'active'
  }
  if (f.category) filter.category = f.category
  if (f.language) filter.language = f.language
  if (f.difficulty) filter.difficulty = f.difficulty
  if (f.q) {
    // Regex (escaped) so short/partial words match too; text index covers ranking elsewhere.
    const rx = new RegExp(escapeRegex(f.q), 'i')
    filter.$or = [{ title: rx }, { description: rx }]
  }
  const sort: Record<string, 1 | -1> = f.sort === 'popular' ? { playCount: -1, createdAt: -1 } : f.sort === 'rating' ? { ratingAvg: -1, ratingCount: -1 } : { createdAt: -1 }
  const [items, total] = await Promise.all([
    Quiz.find(filter).sort(sort).skip((f.page - 1) * f.limit).limit(f.limit).populate('creator', 'name username'),
    Quiz.countDocuments(filter),
  ])
  return { items: items.map((x) => quizDto(x, viewer)), total, page: f.page, pages: Math.max(1, Math.ceil(total / f.limit)) }
}

export async function setFavorite(user: UserDoc, id: string, on: boolean) {
  const quiz = await Quiz.findById(id)
  if (!quiz || !canView(quiz, user)) throw notFound('QUIZ_NOT_FOUND')
  const has = user.favorites.some((f) => sid(f) === id)
  if (on && !has) {
    await User.updateOne({ _id: user._id }, { $addToSet: { favorites: quiz._id } })
    await Quiz.updateOne({ _id: id }, { $inc: { favoritesCount: 1 } })
  } else if (!on && has) {
    await User.updateOne({ _id: user._id }, { $pull: { favorites: quiz._id } })
    await Quiz.updateOne({ _id: id, favoritesCount: { $gt: 0 } }, { $inc: { favoritesCount: -1 } })
  }
  return { favorite: on }
}

export async function rateQuiz(user: UserDoc, id: string, value: number) {
  const quiz = await Quiz.findById(id)
  if (!quiz || !canView(quiz, user)) throw notFound('QUIZ_NOT_FOUND')
  // Only players who actually completed this quiz may rate it.
  if (!(await GameResult.exists({ user: user._id, quiz: quiz._id }))) throw forbidden('PLAY_FIRST')
  const existing = quiz.ratings.find((r) => sid(r.user) === sid(user._id))
  if (existing) existing.value = value
  else quiz.ratings.push({ user: user._id, value })
  quiz.ratingCount = quiz.ratings.length
  quiz.ratingAvg = quiz.ratings.reduce((n, r) => n + (r.value ?? 0), 0) / quiz.ratings.length
  await quiz.save()
  return { ratingAvg: Math.round(quiz.ratingAvg * 10) / 10, ratingCount: quiz.ratingCount }
}

export async function duplicateQuiz(user: UserDoc, id: string) {
  const src = await Quiz.findById(id)
  if (!src || !canView(src, user)) throw notFound('QUIZ_NOT_FOUND')
  // Reuse is allowed for public quizzes and for your own private ones.
  if (src.visibility === 'private' && !canManage(src, user)) throw forbidden('NOT_ALLOWED')
  const copy = await Quiz.create({
    title: `${src.title} (copy)`.slice(0, 80),
    description: src.description,
    category: src.category,
    language: src.language,
    difficulty: src.difficulty,
    coverImage: src.coverImage,
    questions: src.questions.map((x) => ({ text: x.text, options: x.options.map((o) => ({ text: o.text })), correctIndex: x.correctIndex, timeLimit: x.timeLimit, explanation: x.explanation })),
    visibility: 'private',
    creator: user._id,
  })
  return quizEditDto(copy)
}

export async function reportQuiz(user: UserDoc, id: string, reason: string) {
  const quiz = await Quiz.findById(id)
  if (!quiz || !canView(quiz, user)) throw notFound('QUIZ_NOT_FOUND')
  if (await Report.exists({ reporter: user._id, targetType: 'quiz', targetId: quiz._id, status: 'open' })) throw badRequest('ALREADY_REPORTED')
  await Report.create({ reporter: user._id, targetType: 'quiz', targetId: quiz._id, reason })
  return { reported: true }
}
