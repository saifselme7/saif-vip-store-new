import { Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'

export default function NotFoundPage() {
  usePageMeta('404', 'Page not found.')

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-7xl font-black tracking-tighter text-saif-text mb-4">404</h1>
      <p className="text-saif-dim mb-8">This page doesn&apos;t exist.</p>
      <Link to="/" className="btn">Back Home</Link>
    </div>
  )
}
