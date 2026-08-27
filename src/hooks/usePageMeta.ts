import { useEffect } from 'react'

const BASE = 'SAIF STORE'

/** Lightweight SEO: document title + meta description + canonical. */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${BASE}` : BASE
    document.title = fullTitle

    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      meta.content = description
      let og = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')
      if (!og) {
        og = document.createElement('meta')
        og.setAttribute('property', 'og:description')
        document.head.appendChild(og)
      }
      og.content = description
    }

    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
    if (!ogTitle) {
      ogTitle = document.createElement('meta')
      ogTitle.setAttribute('property', 'og:title')
      document.head.appendChild(ogTitle)
    }
    ogTitle.content = fullTitle

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = window.location.origin + window.location.pathname
  }, [title, description])
}
