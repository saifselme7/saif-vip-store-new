import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { SiteSettings } from '@/types'

interface AppContextType {
  settings: SiteSettings | null
  settingsLoading: boolean
  refreshSettings: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  const refreshSettings = useCallback(async () => {
    const { data } = await supabase.from('site_settings').select('*').limit(1).maybeSingle()
    if (data) setSettings(data as SiteSettings)
    setSettingsLoading(false)
  }, [])

  useEffect(() => {
    refreshSettings()
  }, [refreshSettings])

  const value = useMemo(() => ({ settings, settingsLoading, refreshSettings }), [settings, settingsLoading, refreshSettings])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
