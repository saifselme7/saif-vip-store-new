import { useEffect, useState } from 'react'
import { ShieldCheck, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import { formatDate } from '@/lib/utils'
import Loading from '@/components/Loading'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { Profile } from '@/types'

export default function AdminUsers() {
  const { user: me } = useAuth()
  const { addToast } = useApp()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<{ profile: Profile; role: 'admin' | 'customer' } | null>(null)
  const [busy, setBusy] = useState(false)

  usePageMeta('Admin Users', 'Manage administrator access.')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers((data || []) as Profile[])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmRoleChange() {
    if (!pending) return
    setBusy(true)
    const { error } = await supabase.rpc('set_user_role', { p_user_id: pending.profile.id, p_role: pending.role })
    setBusy(false)
    if (error) addToast(error.message || 'Failed to change role', 'error')
    else addToast(`${pending.profile.full_name || 'User'} is now ${pending.role}`)
    setPending(null)
    load()
  }

  return (
    <div className="animate-[pageIn_0.4s_ease]">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">Admin Users</h1>
        <button onClick={load} className="text-xs text-saif-dim hover:text-saif-text flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
      </div>
      <p className="text-sm text-saif-dim mb-6 max-w-2xl">
        Role changes go through a protected database function — regular users can never change roles
        themselves, including via the API.
      </p>

      {loading ? <Loading /> : (
        <div className="border border-saif-border overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-saif-border text-left">
                {['User', 'Role', 'Joined', 'Action'].map(h => (
                  <th key={h} className="p-4 text-[10px] uppercase tracking-wider text-saif-dim font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-saif-border hover:bg-white/[0.03] transition-colors">
                  <td className="p-4">
                    <p className="font-medium text-saif-text">{u.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-saif-dim">{u.id === me?.id ? 'You' : ''}</p>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase ${u.role === 'admin' ? 'text-saif-accent' : 'text-saif-dim'}`}>
                      {u.role === 'admin' && <ShieldCheck size={12} />} {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-saif-dim">{formatDate(u.created_at)}</td>
                  <td className="p-4">
                    {u.id === me?.id ? (
                      <span className="text-xs text-saif-dim">—</span>
                    ) : (
                      <button
                        onClick={() => setPending({ profile: u, role: u.role === 'admin' ? 'customer' : 'admin' })}
                        className="btn text-[10px] px-3 py-2"
                      >
                        {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={pending?.role === 'admin' ? 'Grant admin access?' : 'Revoke admin access?'}
        message={pending?.role === 'admin'
          ? `${pending?.profile.full_name || 'This user'} will gain full control of the store dashboard, orders and payments.`
          : `${pending?.profile.full_name || 'This user'} will lose dashboard access and become a regular customer.`}
        confirmLabel={pending?.role === 'admin' ? 'Grant Admin' : 'Revoke'}
        danger={pending?.role !== 'admin'}
        busy={busy}
        onConfirm={confirmRoleChange}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
