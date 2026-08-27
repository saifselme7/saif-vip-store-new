import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUp } = useAuth()
  const { addToast } = useApp()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  usePageMeta('Create Account', 'Join SAIF STORE.')
  const next = searchParams.get('next')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (fullName.trim().length < 2) {
      addToast('Please enter your full name', 'error')
      return
    }
    if (password.length < 6) {
      addToast('Password must be at least 6 characters', 'error')
      return
    }
    setLoading(true)
    const { error } = await signUp(email.trim(), password, fullName.trim())
    setLoading(false)
    if (error) {
      addToast(error.message || 'Registration failed', 'error')
    } else {
      addToast('Account created — welcome to SAIF STORE!')
      navigate(next && next.startsWith('/') ? next : '/', { replace: true })
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-[pageIn_0.5s_ease]">
        <h1 className="text-3xl font-black tracking-tighter text-saif-text mb-2">Create Account</h1>
        <p className="text-sm text-saif-dim mb-8">Track orders, save wishlists, check out faster.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="label">Full Name</label>
            <input id="reg-name" required type="text" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="reg-email" className="label">Email</label>
            <input id="reg-email" required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="reg-password" className="label">Password</label>
            <input id="reg-password" required type="password" autoComplete="new-password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="input" />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-saif-dim text-center">
          Already have an account?{' '}
          <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-saif-text hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
