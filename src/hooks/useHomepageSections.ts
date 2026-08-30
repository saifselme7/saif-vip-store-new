import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { HomepageSection } from '@/types'

/** Section-specific config shapes (JSONB from the DB). */
export interface HeroConfig {
  eyebrow_en?: string
  eyebrow_ar?: string
  eyebrow_mid_en?: string
  eyebrow_mid_ar?: string
  eyebrow_end_en?: string
  eyebrow_end_ar?: string
  cta1_text_en?: string
  cta1_text_ar?: string
  cta1_dest?: string
  cta2_text_en?: string
  cta2_text_ar?: string
  cta2_dest?: string
  overlay?: number
  campaign_en?: string
  campaign_ar?: string
}

export interface RailConfig {
  source?: 'auto' | 'newest' | 'offers' | 'digital' | 'bestsellers' | 'manual'
  product_ids?: string[]
  limit?: number
  view_all?: string
}

/**
 * Sections the fashion storefront no longer renders. `rail_digital` belonged
 * to the retired digital-catalogue concept: the storefront skips it whenever
 * it is enabled (legacy databases keep the row so the site builder and its
 * history stay intact), and the fashion migration disables it at the source.
 */
export const RETIRED_SECTION_KEYS = new Set(['rail_digital'])

export interface SpotlightConfig {
  product_id?: string | null
  heading_en?: string
  heading_ar?: string
  cta_text_en?: string
  cta_text_ar?: string
}

export interface CategoriesConfig {
  streetwear_label_en?: string
  streetwear_label_ar?: string
  digital_label_en?: string
  digital_label_ar?: string
  cta_text_en?: string
  cta_text_ar?: string
}

export interface BrandConfig {
  fact1_title_en?: string
  fact1_title_ar?: string
  fact1_text_en?: string
  fact1_text_ar?: string
  fact2_title_en?: string
  fact2_title_ar?: string
  fact2_text_en?: string
  fact2_text_ar?: string
  fact3_title_en?: string
  fact3_title_ar?: string
  fact3_text_en?: string
  fact3_text_ar?: string
}

export interface ReviewsConfig {
  count?: number
  mode?: 'latest' | 'highest'
}

export interface HowItWorksConfig {
  steps?: { title_en: string; title_ar: string; text_en: string; text_ar: string }[]
}

export interface FinalCtaConfig {
  cta_text_en?: string
  cta_text_ar?: string
  cta_dest?: string
  secondary_text_en?: string
  secondary_text_ar?: string
  secondary_dest?: string
}

export interface AnnouncementConfig {
  link?: string
  link_text?: string
}

export type SectionConfig =
  | HeroConfig
  | RailConfig
  | SpotlightConfig
  | CategoriesConfig
  | BrandConfig
  | ReviewsConfig
  | HowItWorksConfig
  | FinalCtaConfig
  | AnnouncementConfig
  | Record<string, unknown>

export const SECTION_KEYS = [
  'announcement',
  'hero',
  'brand',
  'categories',
  'spotlight',
  'rail_featured',
  'rail_new',
  'rail_offers',
  'rail_digital',
  'rail_bestsellers',
  'reviews',
  'how_it_works',
  'final_cta',
] as const
// The storefront renders every key above except the retired ones.
export const RENDERABLE_SECTION_KEYS = SECTION_KEYS.filter(k => !RETIRED_SECTION_KEYS.has(k))

export type SectionKey = (typeof SECTION_KEYS)[number]

/**
 * Fallback defaults for the fashion storefront — used when the CMS table is
 * empty or unreachable, so the homepage never renders blank. Mirrors the
 * content shipped in the fashion migration so an un-migrated database and
 * the code defaults tell the same story.
 */
export const DEFAULT_SECTIONS: HomepageSection[] = [
  {
    id: 'def-announcement', section_key: 'announcement', is_enabled: true, position: 0,
    title_en: null, title_ar: null, subtitle_en: null, subtitle_ar: null,
    config: {}, created_at: '', updated_at: '',
  },
  {
    id: 'def-hero', section_key: 'hero', is_enabled: true, position: 1,
    title_en: null, title_ar: null, subtitle_en: null, subtitle_ar: null,
    config: {
      cta1_text_en: 'Explore the Collection', cta1_dest: '/products',
      cta2_text_en: 'See What\u2019s New', cta2_dest: '/products?sort=newest',
    }, created_at: '', updated_at: '',
  },
  {
    id: 'def-brand', section_key: 'brand', is_enabled: true, position: 2,
    title_en: 'Made to be worn, not stored.',
    subtitle_en: 'SAIF STORE is an Egyptian fashion label building pieces that outlast trends — heavy fabrics, considered cuts, honest details. Every drop is small and limited, and every piece has a story.',
    title_ar: 'اتعملت عشان تتلبس، مش تتخزن.',
    subtitle_ar: 'SAIF STORE ماركة ملابس مصرية بتصمم قطع تعيش أطول من الترند — خامات تقيلة، قصات مدروسة، وتفاصيل مضبوطة. كل دروب صغير ومحدود، وكل قطعة ليها قصة.',
    config: {}, created_at: '', updated_at: '',
  },
  {
    id: 'def-categories', section_key: 'categories', is_enabled: true, position: 3,
    title_en: 'Pick your uniform.',
    subtitle_en: 'From tees to jackets — every category holds pieces chosen with one standard.',
    title_ar: 'اختار ستايلك.',
    subtitle_ar: 'من التيشيرت للجاكيت — كل قسم فيه قطع مختارة بعناية لكل اللوكات.',
    config: {}, created_at: '', updated_at: '',
  },
  {
    id: 'def-spotlight', section_key: 'spotlight', is_enabled: true, position: 4,
    title_en: null, title_ar: null, subtitle_en: null, subtitle_ar: null,
    config: {}, created_at: '', updated_at: '',
  },
  {
    id: 'def-rail-featured', section_key: 'rail_featured', is_enabled: true, position: 5,
    title_en: 'Hand-picked from the current drop.',
    subtitle_en: 'The pieces we would put in your hands first.',
    title_ar: 'اختياراتنا من الدروب الحالي.',
    subtitle_ar: 'القطع اللي هنبدأ بيها لو كنت قدامنا.',
    config: { source: 'auto', limit: 8, view_all: '/products?featured=true' }, created_at: '', updated_at: '',
  },
  {
    id: 'def-rail-new', section_key: 'rail_new', is_enabled: true, position: 6,
    title_en: 'Fresh in.', subtitle_en: 'The latest additions to the catalogue.',
    title_ar: 'وصل حديثًا.', subtitle_ar: 'آخر اللي اتضاف للكتالوج.',
    config: { source: 'newest', limit: 8, view_all: '/products?sort=newest' }, created_at: '', updated_at: '',
  },
  {
    id: 'def-rail-offers', section_key: 'rail_offers', is_enabled: true, position: 7,
    title_en: 'Marked down. While they last.',
    subtitle_en: 'Real discounts on current stock — no countdowns, no games.',
    title_ar: 'تخفيضات. لحد ما تخلص.',
    subtitle_ar: 'تخفيضات حقيقية على المخزون الحالي — من غير عدادات ولا ألعاب.',
    config: { source: 'offers', limit: 4, view_all: '/products?onSale=true' }, created_at: '', updated_at: '',
  },
  {
    id: 'def-rail-bestsellers', section_key: 'rail_bestsellers', is_enabled: true, position: 8,
    title_en: 'The pieces everyone comes back for.',
    subtitle_en: 'Best sellers, ranked by real orders.',
    title_ar: 'القطع اللي الناس بترجع تدور عليها.',
    subtitle_ar: 'الأكثر مبيعًا، مرتبة على حسب طلبات حقيقية.',
    config: { source: 'bestsellers', limit: 8, view_all: '/products?bestseller=true' }, created_at: '', updated_at: '',
  },
  {
    id: 'def-reviews', section_key: 'reviews', is_enabled: true, position: 9,
    title_en: 'What customers say.',
    subtitle_en: 'Approved reviews from verified orders — moderated by our team.',
    title_ar: 'اللي العملاء بيقولوه.',
    subtitle_ar: 'مراجعات معتمدة من طلبات حقيقية — بمراجعة فريقنا.',
    config: { count: 3, mode: 'latest' }, created_at: '', updated_at: '',
  },
  {
    id: 'def-how', section_key: 'how_it_works', is_enabled: true, position: 10,
    title_en: 'Ordered. Transferred. Verified.',
    subtitle_en: 'No card needed. A payment flow built on manual verification — slow enough to be careful, fast enough to feel instant.',
    title_ar: 'طلبت. حوّلت. اتأكدنا.',
    subtitle_ar: 'من غير كروت. نظام دفع مبني على مراجعة بشرية — بالراحة الكفاية عشان نتأكد، وبالسرعة الكفاية عشان تحس إنه فوري.',
    config: {}, created_at: '', updated_at: '',
  },
  {
    id: 'def-final', section_key: 'final_cta', is_enabled: true, position: 11,
    title_en: null, title_ar: null,
    subtitle_en: 'Limited pieces, heavy fabrics, and details you won\u2019t find anywhere else.',
    subtitle_ar: 'قطع محدودة، خامات تقيلة، وتفاصيل مش هتلاقيها في أي حتة تانية.',
    config: {}, created_at: '', updated_at: '',
  },
]

/** Loads the CMS-driven homepage sections with safe defaults. */
export function useHomepageSections() {
  const [sections, setSections] = useState<HomepageSection[]>(DEFAULT_SECTIONS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('homepage_sections')
      .select('*')
      .order('position', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        if (data && data.length > 0) {
          const byKey = new Map((data as HomepageSection[]).map(s => [s.section_key, s]))
          // Preserve default ordering for any section missing from the DB
          const merged = DEFAULT_SECTIONS.map(def => byKey.get(def.section_key) ?? def)
          // Include any DB-only sections (custom future sections) at the end
          for (const s of data as HomepageSection[]) {
            if (!DEFAULT_SECTIONS.some(d => d.section_key === s.section_key)) merged.push(s)
          }
          merged.sort((a, b) => a.position - b.position)
          setSections(merged)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { sections, loading }
}

/** Picks the localized title/subtitle of a section. */
export function sectionText(
  section: HomepageSection,
  lang: 'en' | 'ar',
): { title: string | null; subtitle: string | null } {
  const pick = (own: string | null | undefined) =>
    typeof own === 'string' && own.trim() ? own : null
  return {
    title: pick(lang === 'ar' ? section.title_ar : section.title_en),
    subtitle: pick(lang === 'ar' ? section.subtitle_ar : section.subtitle_en),
  }
}

/** Picks a bilingual config field like cta1_text_en / cta1_text_ar. */
/**
 * Picks a bilingual config field (e.g. cta1_text_en / cta1_text_ar).
 * Returns undefined when the requested language's value is missing —
 * callers fall back to t() so untranslated CMS content degrades to the
 * UI dictionary, never to the wrong language.
 */
export function configText(
  config: object | null | undefined,
  base: string,
  lang: 'en' | 'ar',
): string | undefined {
  if (!config) return undefined
  const record = config as Record<string, unknown>
  const value = record[`${base}_${lang}`]
  return typeof value === 'string' && value.trim() ? value : undefined
}
