import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useWishlist } from '@/hooks/useWishlist'
import { usePageMeta } from '@/hooks/usePageMeta'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
import { ProductGridSkeleton } from '@/components/ui/Skeletons'
import EmptyState from '@/components/EmptyState'

export default function WishlistPage() {
  const { user } = useAuth()
  const { items, loading } = useWishlist()
  usePageMeta({ title: 'Wishlist', description: 'Products you saved for later at SAIF STORE.' })

  if (!user) {
    return (
      <div className="pt-28 px-5">
        <EmptyState
          icon={Heart}
          title="Sign in to view your wishlist"
          description="Save products you love and find them here on any device."
          action={
            <Link to="/login?redirect=/wishlist" className="btn btn-primary">
              Sign In
            </Link>
          }
        />
        <Footer />
      </div>
    )
  }

  return (
    <div className="animate-[pageIn_0.6s_ease] pt-24 md:pt-28 px-5 lg:px-10 pb-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-[clamp(34px,6vw,72px)] font-black tracking-tighter text-saif-text mb-10">Wishlist</h1>
        {loading ? (
          <ProductGridSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Tap the heart on any product to save it for later."
            action={
              <Link to="/products" className="btn btn-primary">
                Browse Products
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
