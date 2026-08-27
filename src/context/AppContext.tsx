import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { SiteSettings } from '@/types'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppContextType {
  settings: SiteSettings | null
  refreshSettings: () => Promise<void>
  toasts: Toast[]
  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (v: boolean) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('site_settings').select('*').limit(1).maybeSingle()
    if (data) setSettings(data as unknown as SiteSettings)
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-3), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <AppContext.Provider value={{
      settings, refreshSettings: loadSettings, toasts, addToast, removeToast,
      mobileMenuOpen, setMobileMenuOpen,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
