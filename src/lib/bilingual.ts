import type { Lang } from '@/i18n'
import type { Category, Product, ProductVariant } from '@/types'

/** Localized view of a product (falls back to English when Arabic is empty). */
export interface LocalizedProduct {
  name: string
  description: string
  shortDescription: string
  deliveryInfo: string | null
  specifications: Record<string, string>
  seoTitle: string | null
  seoDescription: string | null
}

export function localizeProduct(product: Product | null | undefined, lang: Lang): LocalizedProduct {
  const pick = (ar: string | null | undefined, en: string | null | undefined) =>
    (lang === 'ar' && ar?.trim() ? ar : (en ?? '')) || ''
  let specs: Record<string, string> = {}
  const raw =
    lang === 'ar' &&
    product?.specifications_ar &&
    Object.keys(product.specifications_ar as object).length > 0
      ? product.specifications_ar
      : product?.specifications
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    specs = raw as Record<string, string>
  }
  return {
    name: pick(product?.name_ar, product?.name),
    description: pick(product?.description_ar, product?.description),
    shortDescription: pick(product?.short_description_ar, product?.short_description),
    deliveryInfo:
      (lang === 'ar' && product?.delivery_info_ar?.trim() ? product.delivery_info_ar : product?.delivery_info) ?? null,
    specifications: specs,
    seoTitle: (lang === 'ar' && product?.seo_title_ar?.trim() ? product.seo_title_ar : product?.seo_title) ?? null,
    seoDescription:
      (lang === 'ar' && product?.seo_description_ar?.trim() ? product.seo_description_ar : product?.seo_description) ?? null,
  }
}

export function localizeCategory(
  category: { name: string; name_ar?: string | null } | null | undefined,
  lang: Lang,
): { name: string } {
  if (!category) return { name: '' }
  return { name: (lang === 'ar' && category.name_ar?.trim() ? category.name_ar : category.name) || '' }
}

/** Effective stock for a line (variant stock wins when selected). */
export function effectiveLineStock(product: Product, variant: ProductVariant | null): number {
  return variant ? variant.stock : product.stock
}
