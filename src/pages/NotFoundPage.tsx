import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'

export default function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-display text-saif-text mb-4">{t('notFound.title')}</h1>
      <p className="text-saif-dim mb-8">{t('notFound.title')}</p>
      <Link to="/" className="btn">{t('notFound.back')}</Link>
    </div>
  )
}
