import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn } = useAuth()
  const { addToast } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  usePageMeta('Sign In', 'Sign in to your SAIF STORE account.')
  const next = searchParams.get('next')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      addToast(error.message || 'Login failed', 'error')
    } else {
      addToast('Welcome back!')
      navigate(next && next.startsWith('/') ? next : '/', { replace: true })
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-[pageIn_0.5s_ease]">
        <h1 className="text-3xl font-black tracking-tighter text-saif-text mb-2">Sign In</h1>
        <p className="text-sm text-saif-dim mb-8">Welcome back to SAIF STORE.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="label">Email</label>
            <input id="login-email" required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="login-password" className="label">Password</label>
            <input id="login-password" required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="input" />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-sm text-saif-dim text-center">
          Don&apos;t have an account?{' '}
          <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-saif-text hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  )
}
