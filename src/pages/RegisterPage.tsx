import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { validateFullName, validateEmail, validatePassword, type FieldErrors } from '@/lib/validation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

export default function RegisterPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'
  const { signUp } = useAuth()
  const { addToast } = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  usePageMeta({ title: 'Create Account', description: 'Join SAIF STORE today.' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: FieldErrors = {
      name: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    }
    setErrors(errs)
    if (Object.values(errs).some(v => v)) return

    setLoading(true)
    const { error } = await signUp(email, password, fullName)
    setLoading(false)
    if (error) {
      addToast(error || t('errors.generic'), 'error')
    } else {
      addToast(t('auth.accountCreated'))
      navigate(redirectTo, { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 pt-20">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-display text-saif-text mb-2">{t('auth.createTitle')}</h1>
        <p className="text-sm text-saif-dim mb-8">{t('auth.createSubtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="rg-name">{t('auth.fullName')}</label>
            <input
              id="rg-name"
              required
              type="text"
              className={cn('input', errors.name && 'input-error')}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoComplete="name"
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div>
            <label className="label" htmlFor="rg-email">{t('auth.email')}</label>
            <input
              id="rg-email"
              required
              type="email"
              className={cn('input', errors.email && 'input-error')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
          <div>
            <label className="label" htmlFor="rg-password">{t('auth.password')}</label>
            <input
              id="rg-password"
              required
              type="password"
              className={cn('input', errors.password && 'input-error')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t('auth.passwordHint')}
            />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-saif-dim text-center">
          {t('auth.haveAccount')}{' '}
          <Link to={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="text-saif-text hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
