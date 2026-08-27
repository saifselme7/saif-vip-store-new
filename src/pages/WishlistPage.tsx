import { Link } from 'react-router-dom'
import { useWishlist } from '@/context/WishlistContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import ProductCard from '@/components/ProductCard'
import EmptyState from '@/components/EmptyState'
import Loading from '@/components/Loading'

export default function WishlistPage() {
  const { items, loading } = useWishlist()
  usePageMeta('Wishlist', 'Your saved SAIF STORE products.')

  return (
    <div className="animate-[pageIn_0.5s_ease] px-4 sm:px-6 lg:px-10 pt-10 pb-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-saif-text mb-10">Wishlist</h1>
        {loading ? <Loading /> : items.length === 0 ? (
          <>
            <EmptyState title="Your wishlist is empty" description="Tap the heart on any product to save it for later." />
            <div className="text-center"><Link to="/products" className="btn text-xs">Browse Products</Link></div>
          </>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6">
            {items.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
