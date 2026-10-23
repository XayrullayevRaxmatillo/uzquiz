import type { uz } from './uz'

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }
export type Dict = Widen<typeof uz>

type Join<K extends string, P extends string> = `${K}.${P}`
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]> & string>
}[keyof T & string]
export type TKey = Paths<Dict>
export type Lang = 'uz' | 'ru' | 'en'
export const LANGS: readonly Lang[] = ['uz', 'ru', 'en'] as const
