import { useEffect } from 'react'

interface MetaOptions {
  title: string
  description?: string
  image?: string
  type?: string
}

function upsertMeta(selector: string, attr: string, value: string, key: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Lightweight per-page SEO metadata (title, description, Open Graph, canonical). */
export function usePageMeta({ title, description, image, type = 'website' }: MetaOptions) {
  useEffect(() => {
    // Defensive: a page must never crash the whole app over metadata.
    const safeTitle = title ?? 'SAIF STORE'
    const fullTitle = safeTitle.includes('SAIF STORE') ? safeTitle : `${safeTitle} — SAIF STORE`
    document.title = fullTitle

    if (description) {
      upsertMeta('meta[name="description"]', 'name', description, 'description')
      upsertMeta('meta[property="og:description"]', 'property', description, 'og:description')
    }
    upsertMeta('meta[property="og:title"]', 'property', fullTitle, 'og:title')
    upsertMeta('meta[property="og:type"]', 'property', type, 'og:type')
    if (image) upsertMeta('meta[property="og:image"]', 'property', image, 'og:image')
    upsertLink('canonical', window.location.href)

    return () => {
      document.title = 'SAIF STORE'
    }
  }, [title, description, image, type])
}
