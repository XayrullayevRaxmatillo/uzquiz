import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useI18n, type Lang } from '../i18n'

export interface CategoryItem {
  slug: string
  names: Record<Lang, string>
  color: string
  icon: string
}

/** Used when the API is unreachable or not seeded yet, so filters and editors still work. */
export const FALLBACK_CATEGORIES: CategoryItem[] = [
  { slug: 'it', names: { uz: 'IT', ru: 'IT', en: 'IT' }, color: '#8b5cf6', icon: 'code' },
  { slug: 'english', names: { uz: 'Ingliz tili', ru: 'Английский язык', en: 'English' }, color: '#22d3ee', icon: 'languages' },
  { slug: 'math', names: { uz: 'Matematika', ru: 'Математика', en: 'Mathematics' }, color: '#f59e0b', icon: 'calculator' },
  { slug: 'science', names: { uz: 'Fan', ru: 'Наука', en: 'Science' }, color: '#22c55e', icon: 'flask' },
  { slug: 'history', names: { uz: 'Tarix', ru: 'История', en: 'History' }, color: '#fb7185', icon: 'landmark' },
  { slug: 'geography', names: { uz: 'Geografiya', ru: 'География', en: 'Geography' }, color: '#3b82f6', icon: 'globe' },
  { slug: 'general', names: { uz: 'Umumiy bilim', ru: 'Общие знания', en: 'General knowledge' }, color: '#ec4899', icon: 'lightbulb' },
]

export function useCategories() {
  const { lang } = useI18n()
  const q = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: CategoryItem[] }>('/categories'),
    staleTime: 5 * 60_000,
  })
  const items = q.data?.items?.length ? q.data.items : FALLBACK_CATEGORIES
  const name = (slug: string) => items.find((c) => c.slug === slug)?.names[lang] ?? slug
  const color = (slug: string) => items.find((c) => c.slug === slug)?.color ?? '#8b5cf6'
  return { items, name, color }
}
