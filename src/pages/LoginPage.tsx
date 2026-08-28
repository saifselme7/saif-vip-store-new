import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { validateEmail, type FieldErrors } from '@/lib/validation'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'
  const { signIn } = useAuth()
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  usePageMeta({ title: 'Sign In', description: 'Sign in to your SAIF STORE account.' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: FieldErrors = {
      email: validateEmail(email),
      password: password ? undefined : 'Password is required',
    }
    setErrors(errs)
    if (Object.values(errs).some(v => v)) return

    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      addToast(error, 'error')
    } else {
      addToast('Welcome back')
      navigate(redirectTo, { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 pt-20">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-black tracking-tighter text-saif-text mb-2">Sign In</h1>
        <p className="text-sm text-saif-dim mb-8">Welcome back to SAIF STORE.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="li-email">Email</label>
            <input
              id="li-email"
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
            <label className="label" htmlFor="li-password">Password</label>
            <input
              id="li-password"
              required
              type="password"
              className={cn('input', errors.password && 'input-error')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-sm text-saif-dim text-center">
          Don&apos;t have an account?{' '}
          <Link to={`/register?redirect=${encodeURIComponent(redirectTo)}`} className="text-saif-text hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
