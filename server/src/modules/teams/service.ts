import { Types, type FilterQuery } from 'mongoose'
import { Team, TeamQueue, type TeamDoc } from '../../models/Team.js'
import { User, type UserDoc } from '../../models/User.js'
import { Notification } from '../../models/Misc.js'
import { AppError, badRequest, conflict, forbidden, notFound } from '../../utils/errors.js'
import { randomCode } from '../../utils/crypto.js'

const ONLINE_WINDOW_MS = 5 * 60_000
const SKILL_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const

interface PopulatedMember {
  user: { _id: Types.ObjectId; name: string; username: string; avatar: string; lastSeenAt: Date | null }
  role: 'owner' | 'moderator' | 'member'
  joinedAt: Date
}
type PopulatedTeam = Omit<TeamDoc, 'members'> & { members: PopulatedMember[] }

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sid = (v: unknown) => String(v)

export function teamDto(team: PopulatedTeam, viewer?: UserDoc) {
  const now = Date.now()
  const viewerId = viewer ? sid(viewer._id) : null
  const myMember = viewerId ? team.members.find((m) => sid(m.user._id) === viewerId) : undefined
  const owner = team.members.find((m) => m.role === 'owner')
  const isStaff = myMember && myMember.role !== 'member'
  const base = {
    id: sid(team._id),
    name: team.name,
    description: team.description,
    avatar: team.avatar,
    category: team.category,
    language: team.language,
    skillLevel: team.skillLevel,
    playStyle: team.playStyle,
    capacity: team.capacity,
    memberCount: team.members.length,
    full: team.members.length >= team.capacity,
    visibility: team.visibility,
    leader: owner ? { id: sid(owner.user._id), name: owner.user.name, username: owner.user.username } : null,
    onlineCount: team.members.filter((m) => m.user.lastSeenAt && now - m.user.lastSeenAt.getTime() < ONLINE_WINDOW_MS).length,
    isMember: !!myMember,
    myRole: myMember?.role ?? null,
    hasRequested: viewerId ? team.joinRequests.some((r) => sid(r.user) === viewerId) : false,
    createdAt: (team as unknown as { createdAt: Date }).createdAt,
  }
  // Member lists of private teams are only visible to members.
  const canSeeMembers = team.visibility === 'public' || !!myMember
  return {
    ...base,
    online: base.onlineCount > 0,
    members: canSeeMembers
      ? team.members.map((m) => ({
          id: sid(m.user._id),
          name: m.user.name,
          username: m.user.username,
          avatar: m.user.avatar,
          role: m.role,
          online: !!m.user.lastSeenAt && now - m.user.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
        }))
      : [],
    inviteCode: myMember ? team.inviteCode : undefined,
    joinRequestCount: isStaff ? team.joinRequests.length : undefined,
  }
}

const populateMembers = { path: 'members.user', select: 'name username avatar lastSeenAt' }

async function loadTeam(id: string): Promise<PopulatedTeam> {
  const t = await Team.findById(id).populate(populateMembers)
  if (!t || t.banned) throw notFound('TEAM_NOT_FOUND')
  return t as unknown as PopulatedTeam
}

export async function getTeam(id: string, viewer?: UserDoc) {
  return teamDto(await loadTeam(id), viewer)
}

export async function listTeams(
  f: {
    category?: string
    language?: string
    skillLevel?: string
    playStyle?: string
    visibility?: string
    minSize?: number
    maxSize?: number
    availableNow?: boolean
    q?: string
    page: number
    limit: number
  },
  viewer?: UserDoc,
) {
  const filter: FilterQuery<TeamDoc> = { banned: false }
  if (f.category) filter.category = f.category
  if (f.language) filter.language = f.language
  if (f.skillLevel) filter.skillLevel = f.skillLevel
  if (f.playStyle) filter.playStyle = f.playStyle
  if (f.visibility) filter.visibility = f.visibility
  if (f.minSize || f.maxSize) filter.capacity = { ...(f.minSize ? { $gte: f.minSize } : {}), ...(f.maxSize ? { $lte: f.maxSize } : {}) }
  if (f.q) filter.nameLower = { $regex: escapeRegex(f.q.toLowerCase()) }
  if (f.availableNow) {
    // Not full AND at least one member active in the last 5 minutes.
    const recent = await User.find({ lastSeenAt: { $gt: new Date(Date.now() - ONLINE_WINDOW_MS) }, team: { $ne: null } }).distinct('team')
    filter._id = { $in: recent }
    filter.$expr = { $lt: [{ $size: '$members' }, '$capacity'] }
  }
  const [items, total] = await Promise.all([
    Team.find(filter)
      .sort({ createdAt: -1 })
      .skip((f.page - 1) * f.limit)
      .limit(f.limit)
      .populate(populateMembers),
    Team.countDocuments(filter),
  ])
  return { items: (items as unknown as PopulatedTeam[]).map((t) => teamDto(t, viewer)), total, page: f.page, pages: Math.max(1, Math.ceil(total / f.limit)) }
}

export async function myTeam(user: UserDoc) {
  if (!user.team) return null
  const t = await Team.findById(user.team).populate(populateMembers)
  if (!t) {
    // Self-heal a dangling reference.
    await User.updateOne({ _id: user._id }, { team: null })
    return null
  }
  return teamDto(t as unknown as PopulatedTeam, user)
}

export async function createTeam(user: UserDoc, input: {
  name: string; description: string; avatar: string; category: string; language: 'uz' | 'ru' | 'en'
  skillLevel: 'beginner' | 'intermediate' | 'advanced'; playStyle: 'casual' | 'competitive'; capacity: number; visibility: 'public' | 'private'
}) {
  if (await Team.exists({ nameLower: input.name.toLowerCase() })) throw conflict('TEAM_NAME_TAKEN', 'Team name taken', { name: 'TEAM_NAME_TAKEN' })
  // Claim the single-team slot atomically first.
  const claimed = await User.findOneAndUpdate({ _id: user._id, team: null }, { team: new Types.ObjectId() }, { new: false })
  if (!claimed) throw conflict('ALREADY_IN_TEAM')
  try {
    const team = await Team.create({
      ...input,
      nameLower: input.name.toLowerCase(),
      owner: user._id,
      members: [{ user: user._id, role: 'owner' }],
      inviteCode: randomCode(8),
    })
    await User.updateOne({ _id: user._id }, { team: team._id })
    void notifyQueueMatches(team)
    return getTeam(team.id, user)
  } catch (e) {
    await User.updateOne({ _id: user._id }, { team: null })
    if ((e as { code?: number }).code === 11000) throw conflict('TEAM_NAME_TAKEN', 'Team name taken', { name: 'TEAM_NAME_TAKEN' })
    throw e
  }
}

/** Atomically adds the user to the team, enforcing capacity, visibility and single-membership. */
async function addMember(teamId: string, userId: Types.ObjectId, opts: { allowPrivate: boolean }) {
  const claimed = await User.findOneAndUpdate({ _id: userId, team: null }, { team: new Types.ObjectId(teamId) })
  if (!claimed) throw conflict('ALREADY_IN_TEAM')
  const res = await Team.updateOne(
    {
      _id: teamId,
      banned: false,
      ...(opts.allowPrivate ? {} : { visibility: 'public' }),
      'members.user': { $ne: userId },
      $expr: { $lt: [{ $size: '$members' }, '$capacity'] },
    },
    { $push: { members: { user: userId, role: 'member', joinedAt: new Date() } }, $pull: { joinRequests: { user: userId } } },
  )
  if (res.modifiedCount !== 1) {
    await User.updateOne({ _id: userId, team: new Types.ObjectId(teamId) }, { team: null })
    const t = await Team.findById(teamId)
    if (!t || t.banned) throw notFound('TEAM_NOT_FOUND')
    if (t.members.length >= t.capacity) throw conflict('TEAM_FULL')
    if (!opts.allowPrivate && t.visibility === 'private') throw forbidden('TEAM_PRIVATE')
    throw conflict('ALREADY_IN_TEAM')
  }
  await TeamQueue.deleteOne({ user: userId })
}

export async function joinPublic(user: UserDoc, teamId: string) {
  await addMember(teamId, user._id, { allowPrivate: false })
  return getTeam(teamId, (await User.findById(user._id))!)
}

export async function joinByCode(user: UserDoc, code: string) {
  const team = await Team.findOne({ inviteCode: code, banned: false })
  if (!team) throw notFound('INVITE_INVALID')
  await addMember(team.id, user._id, { allowPrivate: true })
  return getTeam(team.id, (await User.findById(user._id))!)
}

export async function requestJoin(user: UserDoc, teamId: string, message: string) {
  if (user.team) throw conflict('ALREADY_IN_TEAM')
  const team = await Team.findById(teamId)
  if (!team || team.banned) throw notFound('TEAM_NOT_FOUND')
  if (team.visibility === 'public') throw badRequest('TEAM_IS_PUBLIC', 'Join public teams directly')
  if (team.members.length >= team.capacity) throw conflict('TEAM_FULL')
  const res = await Team.updateOne(
    { _id: teamId, 'joinRequests.user': { $ne: user._id }, 'members.user': { $ne: user._id } },
    { $push: { joinRequests: { user: user._id, message, createdAt: new Date() } } },
  )
  if (res.modifiedCount !== 1) throw conflict('REQUEST_EXISTS')
  const staff = team.members.filter((m) => m.role !== 'member').map((m) => m.user)
  await Notification.insertMany(staff.map((u) => ({ user: u, type: 'team_request', data: { teamId, teamName: team.name, userId: sid(user._id), name: user.name } })))
  return { requested: true }
}

export async function cancelRequest(user: UserDoc, teamId: string) {
  await Team.updateOne({ _id: teamId }, { $pull: { joinRequests: { user: user._id } } })
  return { cancelled: true }
}

function staffRole(team: TeamDoc, user: UserDoc) {
  const m = team.members.find((x) => sid(x.user) === sid(user._id))
  if (!m) throw forbidden('NOT_A_MEMBER')
  return m.role
}

export async function listRequests(user: UserDoc, teamId: string) {
  const team = await Team.findById(teamId).populate({ path: 'joinRequests.user', select: 'name username avatar' })
  if (!team) throw notFound('TEAM_NOT_FOUND')
  if (staffRole(team, user) === 'member') throw forbidden('NOT_STAFF')
  return team.joinRequests.map((r) => {
    const u = r.user as unknown as { _id: Types.ObjectId; name: string; username: string; avatar: string }
    return { userId: sid(u._id), name: u.name, username: u.username, avatar: u.avatar, message: r.message, createdAt: r.createdAt }
  })
}

export async function decideRequest(user: UserDoc, teamId: string, targetId: string, accept: boolean) {
  const team = await Team.findById(teamId)
  if (!team) throw notFound('TEAM_NOT_FOUND')
  if (staffRole(team, user) === 'member') throw forbidden('NOT_STAFF')
  if (!team.joinRequests.some((r) => sid(r.user) === targetId)) throw notFound('REQUEST_NOT_FOUND')
  if (!accept) {
    await Team.updateOne({ _id: teamId }, { $pull: { joinRequests: { user: targetId } } })
    await Notification.create({ user: targetId, type: 'team_rejected', data: { teamId, teamName: team.name } })
    return { accepted: false }
  }
  try {
    await addMember(teamId, new Types.ObjectId(targetId), { allowPrivate: true })
  } catch (e) {
    // Applicant joined another team meanwhile → drop the stale request.
    if (e instanceof AppError && e.code === 'ALREADY_IN_TEAM') await Team.updateOne({ _id: teamId }, { $pull: { joinRequests: { user: targetId } } })
    throw e
  }
  await Notification.create({ user: targetId, type: 'team_accepted', data: { teamId, teamName: team.name } })
  return { accepted: true }
}

export async function leaveTeam(user: UserDoc, teamId: string) {
  const team = await Team.findById(teamId)
  if (!team) throw notFound('TEAM_NOT_FOUND')
  const role = staffRole(team, user)
  const others = team.members.filter((m) => sid(m.user) !== sid(user._id))
  if (others.length === 0) {
    await Team.deleteOne({ _id: teamId })
  } else if (role === 'owner') {
    // Ownership passes to the longest-serving moderator, else the longest-serving member.
    const heir = others.find((m) => m.role === 'moderator') ?? others[0]
    await Team.updateOne({ _id: teamId, 'members.user': heir.user }, { $set: { owner: heir.user, 'members.$.role': 'owner' } })
    await Team.updateOne({ _id: teamId }, { $pull: { members: { user: user._id } } })
  } else {
    await Team.updateOne({ _id: teamId }, { $pull: { members: { user: user._id } } })
  }
  await User.updateOne({ _id: user._id }, { team: null })
  return { left: true }
}

export async function setRole(user: UserDoc, teamId: string, targetId: string, role: 'moderator' | 'member') {
  const team = await Team.findById(teamId)
  if (!team) throw notFound('TEAM_NOT_FOUND')
  if (staffRole(team, user) !== 'owner') throw forbidden('OWNER_ONLY')
  const target = team.members.find((m) => sid(m.user) === targetId)
  if (!target || target.role === 'owner') throw badRequest('INVALID_TARGET')
  await Team.updateOne({ _id: teamId, 'members.user': targetId }, { $set: { 'members.$.role': role } })
  return getTeam(teamId, user)
}

export async function removeMember(user: UserDoc, teamId: string, targetId: string) {
  const team = await Team.findById(teamId)
  if (!team) throw notFound('TEAM_NOT_FOUND')
  const myRole = staffRole(team, user)
  const target = team.members.find((m) => sid(m.user) === targetId)
  if (!target || target.role === 'owner') throw badRequest('INVALID_TARGET')
  if (myRole === 'member' || (myRole === 'moderator' && target.role !== 'member')) throw forbidden('NOT_ALLOWED')
  await Team.updateOne({ _id: teamId }, { $pull: { members: { user: targetId } } })
  await User.updateOne({ _id: targetId, team: team._id }, { team: null })
  return getTeam(teamId, user)
}

export async function updateTeam(user: UserDoc, teamId: string, patch: Record<string, unknown>) {
  const team = await Team.findById(teamId)
  if (!team) throw notFound('TEAM_NOT_FOUND')
  if (staffRole(team, user) === 'member') throw forbidden('NOT_STAFF')
  if (typeof patch.capacity === 'number' && patch.capacity < team.members.length) throw badRequest('CAPACITY_TOO_SMALL')
  if (typeof patch.name === 'string') {
    const lower = patch.name.toLowerCase()
    if (lower !== team.nameLower) {
      if (await Team.exists({ nameLower: lower })) throw conflict('TEAM_NAME_TAKEN', 'Team name taken', { name: 'TEAM_NAME_TAKEN' })
      team.nameLower = lower
    }
  }
  team.set(patch)
  await team.save()
  return getTeam(teamId, user)
}

export async function disbandTeam(user: UserDoc, teamId: string) {
  const team = await Team.findById(teamId)
  if (!team) throw notFound('TEAM_NOT_FOUND')
  if (staffRole(team, user) !== 'owner') throw forbidden('OWNER_ONLY')
  await User.updateMany({ team: team._id }, { team: null })
  await Team.deleteOne({ _id: teamId })
  return { deleted: true }
}

// ───────────── Quick match & waiting queue ─────────────

export interface MatchCriteria {
  category?: string
  language: 'uz' | 'ru' | 'en'
  skillLevel: 'beginner' | 'intermediate' | 'advanced'
  playStyle: 'casual' | 'competitive'
}

function scoreTeam(t: { category: string; language: string; skillLevel: keyof typeof SKILL_RANK; playStyle: string }, c: MatchCriteria, interests: string[]) {
  let score = 0
  if (c.category ? t.category === c.category : interests.includes(t.category)) score += 40
  else if (c.category || interests.length) return -1 // subject mismatch is disqualifying when the user stated one
  const gap = Math.abs(SKILL_RANK[t.skillLevel] - SKILL_RANK[c.skillLevel])
  if (gap === 0) score += 30
  else if (gap === 1) score += 12
  else return -1
  if (t.playStyle === c.playStyle) score += 20
  score += 10 // language already matched by the query
  return score
}

/** Returns real, joinable teams ranked by compatibility. Never fabricates a match. */
export async function quickMatch(user: UserDoc, c: MatchCriteria) {
  if (user.team) throw conflict('ALREADY_IN_TEAM')
  const candidates = await Team.find({
    banned: false,
    visibility: 'public',
    language: c.language,
    $expr: { $lt: [{ $size: '$members' }, '$capacity'] },
  })
    .limit(100)
    .populate(populateMembers)
  const ranked = (candidates as unknown as PopulatedTeam[])
    .map((t) => ({ t, score: scoreTeam(t as never, c, user.interests) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  return {
    matches: ranked.map((x) => ({ score: x.score, team: teamDto(x.t, user) })),
    queued: !!(await TeamQueue.exists({ user: user._id })),
  }
}

export async function joinQueue(user: UserDoc, c: Required<MatchCriteria>) {
  if (user.team) throw conflict('ALREADY_IN_TEAM')
  await TeamQueue.findOneAndUpdate({ user: user._id }, { ...c }, { upsert: true, new: true })
  return { queued: true }
}
export async function leaveQueue(user: UserDoc) {
  await TeamQueue.deleteOne({ user: user._id })
  return { queued: false }
}
export async function queueStatus(user: UserDoc) {
  const q = await TeamQueue.findOne({ user: user._id })
  return { queued: !!q, criteria: q ? { category: q.category, language: q.language, skillLevel: q.skillLevel, playStyle: q.playStyle } : null }
}

/** When a team is created, notify waiting users whose saved criteria fit it. */
async function notifyQueueMatches(team: TeamDoc) {
  if (team.visibility !== 'public') return
  const waiting = await TeamQueue.find({ category: team.category, language: team.language })
  const fits = waiting.filter((w) => Math.abs(SKILL_RANK[w.skillLevel] - SKILL_RANK[team.skillLevel]) <= 1)
  if (!fits.length) return
  await Notification.insertMany(fits.map((w) => ({ user: w.user, type: 'team_available', data: { teamId: String(team._id), teamName: team.name } })))
}
