import { Link } from 'react-router-dom'
import { Clock, Heart, ListChecks, Play, Star, Lock } from 'lucide-react'
import { Chip } from './ui/misc'
import { useI18n, type TKey } from '../i18n'
import { useCategories } from '../lib/useCategories'
import type { QuizCardData } from '../lib/types2'

const DIFF: Record<QuizCardData['difficulty'], TKey> = { easy: 'explore.easy', medium: 'explore.medium', hard: 'explore.hard' }

export function QuizCard({ quiz }: { quiz: QuizCardData }) {
  const { t, lang, formatNumber } = useI18n()
  const cats = useCategories()
  const color = cats.color(quiz.category)
  return (
    <Link to={`/quizzes/${quiz.id}`} className="glass group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:border-line-strong">
      <div className="relative h-32 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, #1b1140)` }}>
        {quiz.coverImage && /^https:\/\//.test(quiz.coverImage) && <img src={quiz.coverImage} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-80" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Chip className="!border-white/20 !bg-black/40 !text-white backdrop-blur">{cats.name(quiz.category)}</Chip>
          {quiz.isDemo && <Chip className="!border-white/20 !bg-black/40 !text-white backdrop-blur">{t('explore.demo')}</Chip>}
          {quiz.visibility === 'private' && <Chip className="!border-white/20 !bg-black/40 !text-white backdrop-blur"><Lock className="size-3" aria-hidden />{t('quiz.private')}</Chip>}
        </div>
        <span className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-white/90 text-brand opacity-0 shadow-lg transition group-hover:opacity-100" aria-hidden><Play className="size-4 fill-current" /></span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug">{quiz.title}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{quiz.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><ListChecks className="size-3.5" aria-hidden />{quiz.questionCount} {t('explore.questions')}</span>
          <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{Math.max(1, Math.round(quiz.totalSeconds / 60))} min</span>
          <span>{t(DIFF[quiz.difficulty])}</span>
        </div>
        {quiz.language !== lang && <p className="mt-2 text-xs font-medium text-warn">{t('explore.originalLang', { lang: quiz.language.toUpperCase() })}</p>}
        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted">
          <span className="flex items-center gap-1" aria-label={quiz.ratingCount ? `${quiz.ratingAvg}/5` : t('quiz.notRated')}>
            <Star className={`size-3.5 ${quiz.ratingCount ? 'fill-warn text-warn' : ''}`} aria-hidden />
            {quiz.ratingCount ? quiz.ratingAvg.toFixed(1) : '—'}
          </span>
          <span>{formatNumber(quiz.playCount)} {t('explore.plays')}</span>
          <span className="flex items-center gap-1"><Heart className={`size-3.5 ${quiz.isFavorite ? 'fill-coral text-coral' : ''}`} aria-hidden />{formatNumber(quiz.favoritesCount)}</span>
        </div>
      </div>
    </Link>
  )
}
