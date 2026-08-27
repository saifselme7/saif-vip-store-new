import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { Profile } from '@/types'

/** Only fields a user may change about their own profile.
 * `role` is intentionally absent — it is protected at the database
 * level (column grants + trigger) and never accepted from clients. */
export type ProfileUpdate = Pick<Profile, 'full_name' | 'phone' | 'avatar_url' | 'address'>

interface AuthContextType {
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<ProfileUpdate>) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile((data as Profile) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
      // Profile rows created by the DB trigger after email confirmation.
      if (event === 'USER_UPDATED' && session?.user) fetchProfile(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    // The handle_new_user trigger creates the profile row with the
    // customer role; no client-side role writing, ever.
    return { error: error as Error | null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function updateProfile(data: Partial<ProfileUpdate>) {
    if (!user) return { error: new Error('Not authenticated') }
    const safe: Partial<ProfileUpdate> = {}
    if (data.full_name !== undefined) safe.full_name = data.full_name
    if (data.phone !== undefined) safe.phone = data.phone
    if (data.avatar_url !== undefined) safe.avatar_url = data.avatar_url
    if (data.address !== undefined) safe.address = data.address
    const { error } = await supabase
      .from('profiles')
      .update(safe as unknown as Database['public']['Tables']['profiles']['Update'])
      .eq('id', user.id)
    if (!error) setProfile(prev => (prev ? { ...prev, ...safe } : prev))
    return { error: error as Error | null }
  }

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  return (
    <AuthContext.Provider value={{
      user, profile, isAdmin: profile?.role === 'admin', loading,
      signUp, signIn, signOut, updateProfile, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
