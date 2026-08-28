import { Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '@/context/AppContext'

export default function MaintenanceScreen() {
  const { settings } = useApp()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 border border-saif-border rounded-full flex items-center justify-center mb-6">
        <Wrench size={26} className="text-saif-accent" />
      </div>
      <h1 className="text-4xl font-black tracking-tighter text-saif-text mb-4">
        {settings?.store_name || 'SAIF STORE'}
      </h1>
      <p className="text-sm text-saif-dim max-w-sm leading-relaxed mb-8">
        We are currently performing scheduled maintenance. Please check back shortly.
      </p>
      <Link to="/" className="btn">
        Refresh
      </Link>
    </div>
  )
}
