import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  viewAllTo?: string
  viewAllLabel?: string
}

export default function SectionHeading({ title, subtitle, viewAllTo, viewAllLabel = 'View All' }: Props) {
  return (
    <div className="flex items-end justify-between mb-8 lg:mb-10 gap-4">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-saif-text">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-saif-dim max-w-md">{subtitle}</p>}
      </div>
      {viewAllTo && (
        <Link
          to={viewAllTo}
          className="text-xs sm:text-sm text-saif-dim hover:text-saif-text transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          {viewAllLabel} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}
