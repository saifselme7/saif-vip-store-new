import { cn } from '@/lib/utils'

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="aspect-[3/4] bg-saif-panel skeleton rounded-sm" />
      <div className="mt-4 space-y-2.5">
        <div className="h-2.5 w-1/3 rounded bg-saif-panel skeleton" />
        <div className="h-3.5 w-3/4 rounded bg-saif-panel skeleton" />
        <div className="h-3 w-1/4 rounded bg-saif-panel skeleton" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-10 md:gap-x-5 md:gap-y-14">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function LineSkeleton({ className }: { className?: string }) {
  return <div className={cn('h-4 bg-saif-panel rounded animate-pulse', className)} />
}

export function CardSkeleton({ className }: { className?: string }) {
  return <div className={cn('border border-saif-border rounded-sm skeleton', className)} />
}
