import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { uz } from './uz'
import { ru } from './ru'
import { en } from './en'
import { LANGS, type Dict, type Lang, type TKey } from './types'

const DICTS: Record<Lang, Dict> = { uz, ru, en }
const STORAGE_KEY = 'uzquiz-lang'
const LOCALES: Record<Lang, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && (LANGS as readonly string[]).includes(v)) return v as Lang
  } catch {
    /* storage unavailable */
  }
  return 'uz'
}

function lookup(dict: Dict, key: string): string {
  let cur: unknown = dict
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part]
    } else {
      return key
    }
  }
  return typeof cur === 'string' ? cur : key
}

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey, vars?: Record<string, string | number>) => string
  formatNumber: (n: number) => string
  formatDate: (d: Date | string | number) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo<I18nValue>(() => {
    const locale = LOCALES[lang]
    return {
      lang,
      setLang,
      t: (key, vars) => {
        let s = lookup(DICTS[lang], key)
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
        return s
      },
      formatNumber: (n) => new Intl.NumberFormat(locale).format(n),
      formatDate: (d) =>
        new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d)),
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

export { LANGS }
export type { Lang, TKey }
