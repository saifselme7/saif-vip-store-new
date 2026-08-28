import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { en, type Dictionary } from './en'
import { ar } from './ar'

export type Lang = 'en' | 'ar'
export type Dir = 'ltr' | 'rtl'

const DICTS: Record<Lang, Dictionary> = { en, ar }
export const LANGUAGES: { code: Lang; short: string; name: string; dir: Dir }[] = [
  { code: 'en', short: 'EN', name: 'English', dir: 'ltr' },
  { code: 'ar', short: 'ع', name: 'العربية', dir: 'rtl' },
]

const STORAGE_KEY = 'saif-lang'

/** Arabic plural categories used by the dictionary keys. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many'

export function pluralCategory(n: number): PluralCategory {
  if (n === 0) return 'zero'
  if (n === 1) return 'one'
  if (n === 2) return 'two'
  if (n >= 3 && n <= 10) return 'few'
  return 'many'
}

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  )
}

export type TranslateFn = {
  (key: string, params?: Record<string, string | number>): string
  /** Plural-aware lookup: resolves `key.zero|one|two|few|many` by count. */
  plural: (key: string, count: number, params?: Record<string, string | number>) => string
}

export interface Localizable {
  name?: string | null
  name_ar?: string | null
  description?: string | null
  description_ar?: string | null
  short_description?: string | null
  short_description_ar?: string | null
  delivery_info?: string | null
  delivery_info_ar?: string | null
  specifications?: unknown
  specifications_ar?: unknown
  seo_title?: string | null
  seo_title_ar?: string | null
  seo_description?: string | null
  seo_description_ar?: string | null
}

interface I18nContextValue {
  lang: Lang
  dir: Dir
  isRTL: boolean
  setLang: (lang: Lang) => void
  t: TranslateFn
  /** Picks the localized field of a DB record with English fallback. */
  localize: <T extends Localizable>(item: T | null | undefined) => {
    name: string
    description: string
    shortDescription: string
    deliveryInfo: string | null
    specifications: Record<string, string>
    seoTitle: string | null
    seoDescription: string | null
  }
  /** Locale-aware price formatting (Latin digits, ج.م in Arabic). */
  formatPrice: (value: number | null | undefined, currency?: string) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'ar') return stored
  } catch {
    /* storage unavailable */
  }
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('ar')) return 'ar'
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang)

  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'

  // Keep <html lang/dir> in sync — semantic RTL + correct font rendering.
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const t = useMemo<TranslateFn>(() => {
    const base = (key: string, params?: Record<string, string | number>): string => {
      const value = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key)
      if (typeof value === 'string') return interpolate(value, params)
      if (import.meta.env?.DEV) {
        console.warn(`[i18n] missing key: ${key} (${lang})`)
      }
      return key
    }
    // Dictionary convention: `key_zero`, `key_one`, `key_two`, `key_few`, `key_many`
    base.plural = (key: string, count: number, params?: Record<string, string | number>) =>
      base(`${key}_${pluralCategory(count)}`, { ...params, count })
    return base
  }, [lang])

  const localize = useCallback<I18nContextValue['localize']>(
    item => {
      const pick = (primary: string | null | undefined, fallback: string | null | undefined) =>
        (lang === 'ar' && primary?.trim() ? primary : (fallback ?? primary ?? '')) || ''
      let specs: Record<string, string> = {}
      const rawSpecs =
        lang === 'ar' && item?.specifications_ar && Object.keys(item.specifications_ar as object).length > 0
          ? item.specifications_ar
          : item?.specifications
      if (rawSpecs && typeof rawSpecs === 'object' && !Array.isArray(rawSpecs)) {
        specs = rawSpecs as Record<string, string>
      }
      return {
        name: pick(item?.name_ar, item?.name),
        description: pick(item?.description_ar, item?.description),
        shortDescription: pick(item?.short_description_ar, item?.short_description),
        deliveryInfo: (lang === 'ar' && item?.delivery_info_ar?.trim()
          ? item.delivery_info_ar
          : item?.delivery_info) ?? null,
        specifications: specs,
        seoTitle: (lang === 'ar' && item?.seo_title_ar?.trim() ? item.seo_title_ar : item?.seo_title) ?? null,
        seoDescription:
          (lang === 'ar' && item?.seo_description_ar?.trim() ? item.seo_description_ar : item?.seo_description) ?? null,
      }
    },
    [lang],
  )

  const formatPrice = useCallback<I18nContextValue['formatPrice']>(
    (value, currency = 'EGP') => {
      const v = typeof value === 'number' && Number.isFinite(value) ? value : 0
      try {
        // Latin digits in both languages; ج.م currency symbol in Arabic.
        const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG'
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          maximumFractionDigits: v % 1 === 0 ? 0 : 2,
        }).format(v)
      } catch {
        return `${currency} ${v.toFixed(2)}`
      }
    },
    [lang],
  )

  const value = useMemo(
    () => ({ lang, dir, isRTL: lang === 'ar', setLang, t, localize, formatPrice }),
    [lang, dir, setLang, t, localize, formatPrice],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}

/** Convenience re-export so components can format prices without prop drilling. */
export { formatPrice as _formatPriceStatic }
function formatPrice(value: number | null | undefined, currency = 'EGP') {
  const v = typeof value === 'number' && Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency,
      maximumFractionDigits: v % 1 === 0 ? 0 : 2,
    }).format(v)
  } catch {
    return `${currency} ${v.toFixed(2)}`
  }
}
