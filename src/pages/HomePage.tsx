import { Link } from 'react-router-dom'
import { ArrowRight, Truck, ShieldCheck, Zap, CreditCard, BadgeCheck, Clock } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { useReviews } from '@/hooks/useReviews'
import { useApp } from '@/context/AppContext'
import { usePageMeta } from '@/hooks/usePageMeta'
import ProductCard from '@/components/ProductCard'
import SectionHeading from '@/components/SectionHeading'
import RatingStars from '@/components/ui/RatingStars'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import EmptyState from '@/components/EmptyState'

export default function HomePage() {
  const { settings } = useApp()
  const { products: featured, loading: fLoading } = useProducts({ featured: true, limit: 8 })
  const { products: newArrivals, loading: nLoading } = useProducts({ sort: 'newest', limit: 8 })
  const { products: bestsellers, loading: bLoading } = useProducts({ bestseller: true, limit: 8 })
  const { products: offers, loading: oLoading } = useProducts({ onSale: true, limit: 4 })
  const { products: digital, loading: dLoading } = useProducts({ type: 'digital', limit: 4 })
  const { products: physical, loading: pLoading } = useProducts({ type: 'physical', limit: 4 })
  const { categories } = useCategories()
  const { reviews } = useReviews()

  usePageMeta(
    settings?.store_name || 'SAIF STORE',
    settings?.store_description || 'Premium streetwear and digital products.',
  )

  const heroProducts = featured.length > 0 ? featured : newArrivals

  return (
    <div className="animate-[pageIn_0.5s_ease]">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-16">
        {/* subtle red glow accent */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #E63946 0%, transparent 65%)' }}
        />
        <div className="max-w-7xl mx-auto relative">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-saif-accent mb-6 animate-[fadeUp_0.6s_0.1s_both]">
            Streetwear · Digital · Curated
          </p>
          <h1 className="text-[clamp(56px,12vw,170px)] font-black tracking-tighter leading-[0.88] text-saif-text">
            {settings?.hero_title || 'SAIF STORE'}<sup className="text-[0.14em] font-normal align-super ml-1">®</sup>
          </h1>
          <p className="mt-6 text-sm sm:text-base text-saif-dim max-w-xl leading-relaxed animate-[fadeUp_0.6s_0.25s_both]">
            {settings?.hero_subtitle || 'Premium fashion and digital products. Carefully curated for the modern individual.'}
          </p>
          <div className="mt-9 flex flex-wrap gap-3 animate-[fadeUp_0.6s_0.4s_both]">
            <Link to="/products" className="btn btn-primary">Shop Now</Link>
            <Link to="/products?type=digital" className="btn">Digital Products</Link>
          </div>

          {/* Hero product strip */}
          {heroProducts.length > 0 && (
            <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 animate-[fadeUp_0.6s_0.55s_both]">
              {heroProducts.slice(0, 4).map(p => (
                <Link key={p.id} to={`/products/${p.slug}`} className="group relative aspect-[3/4] overflow-hidden bg-[#111]">
                  <img
                    src={p.thumbnail || p.images?.[0]}
                    alt={p.name}
                    loading={p === heroProducts[0] ? 'eager' : 'lazy'}
                    className="w-full h-full object-cover transition-transform duration-700 ease-saif group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="absolute bottom-3 left-3 text-xs font-semibold uppercase tracking-wider text-saif-text opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    {p.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ CATEGORIES ============ */}
      {categories.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
          <div className="max-w-7xl mx-auto">
            <SectionHeading title="Shop by Category" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
              {categories.map(cat => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.id}`}
                  className="group relative aspect-square sm:aspect-[4/5] overflow-hidden bg-[#111] border border-saif-border"
                >
                  {cat.image && (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 ease-saif group-hover:scale-110 opacity-50 group-hover:opacity-70"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
                    <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-saif-text">{cat.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-saif-accent opacity-0 group-hover:opacity-100 transition-opacity">
                      Explore →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ FEATURED ============ */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
        <div className="max-w-7xl mx-auto">
          <SectionHeading title="Featured" viewAllTo="/products?featured=true" />
          {fLoading ? <ProductGridSkeleton /> : featured.length === 0 ? (
            <EmptyState title="Nothing featured yet" description="New drops land here first." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6">
              {featured.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* ============ NEW ARRIVALS ============ */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
        <div className="max-w-7xl mx-auto">
          <SectionHeading title="New Arrivals" subtitle="The latest additions to the catalog." viewAllTo="/products?sort=newest" />
          {nLoading ? <ProductGridSkeleton /> : newArrivals.length === 0 ? (
            <EmptyState title="No products yet" description="Check back soon." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6">
              {newArrivals.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* ============ LIMITED COLLECTION BANNER ============ */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
        <div className="max-w-7xl mx-auto relative overflow-hidden bg-saif-accent">
          <div className="relative z-10 px-6 sm:px-12 py-14 sm:py-20 max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 mb-4">Limited Collection</p>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[0.95] text-black">
              Made to be worn.<br />Or judged. Or both.
            </h2>
            <p className="mt-5 text-sm sm:text-base text-black/70 leading-relaxed max-w-md">
              Heavyweight fabrics, minimal prints, zero compromise. Small batches — once they're gone, they're gone.
            </p>
            <Link
              to="/products?featured=true"
              className="mt-8 inline-flex items-center gap-2 bg-black text-saif-text text-xs font-semibold uppercase tracking-wider px-8 py-4 hover:bg-[#111] transition-colors"
            >
              Shop the Collection <ArrowRight size={14} />
            </Link>
          </div>
          <div aria-hidden="true" className="absolute -right-24 -top-24 w-96 h-96 rounded-full border-[40px] border-black/10" />
        </div>
      </section>

      {/* ============ SPECIAL OFFERS ============ */}
      {offers.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
          <div className="max-w-7xl mx-auto">
            <SectionHeading title="Special Offers" subtitle="Discounted right now — no code needed." viewAllTo="/products?sale=1" />
            {oLoading ? <ProductGridSkeleton count={4} /> : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-6">
                {offers.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============ DIGITAL ============ */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            title="Digital Products"
            subtitle="Social media packages — fulfilled by our team after payment verification."
            viewAllTo="/products?type=digital"
          />
          {dLoading ? <ProductGridSkeleton count={4} /> : digital.length === 0 ? (
            <EmptyState title="No digital products yet" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-6">
              {digital.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* ============ PHYSICAL ============ */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
        <div className="max-w-7xl mx-auto">
          <SectionHeading title="Streetwear" viewAllTo="/products?type=physical" />
          {pLoading ? <ProductGridSkeleton count={4} /> : physical.length === 0 ? (
            <EmptyState title="No physical products yet" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-6">
              {physical.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* ============ BESTSELLERS ============ */}
      {bestsellers.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
          <div className="max-w-7xl mx-auto">
            <SectionHeading title="Best Sellers" viewAllTo="/products?bestseller=true" />
            {bLoading ? <ProductGridSkeleton /> : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6">
                {bestsellers.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============ WHY SAIF STORE ============ */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border bg-[#050505]">
        <div className="max-w-7xl mx-auto">
          <SectionHeading title="Why SAIF STORE" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TrustCard
              icon={<Truck size={22} />}
              title="Fast Shipping"
              text={settings?.free_shipping_threshold
                ? `Free shipping on orders over ${settings.free_shipping_threshold} ${settings?.currency || 'EGP'}.`
                : 'Reliable delivery across Egypt.'}
            />
            <TrustCard
              icon={<CreditCard size={22} />}
              title="Easy Manual Payments"
              text="Pay with InstaPay or Vodafone Cash. Every transfer is verified by our team."
            />
            <TrustCard
              icon={<ShieldCheck size={22} />}
              title="Secure & Private"
              text="Your payment proof and personal details are visible only to you and our verification team."
            />
            <TrustCard
              icon={<Zap size={22} />}
              title="Digital Fulfillment"
              text="Digital orders are fulfilled by our team as soon as your payment is approved."
            />
          </div>
        </div>
      </section>

      {/* ============ REVIEWS ============ */}
      {reviews.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
          <div className="max-w-7xl mx-auto">
            <SectionHeading title="Customer Reviews" subtitle="What people say after their orders arrive." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reviews.slice(0, 3).map(r => (
                <div key={r.id} className="border border-saif-border p-6 bg-[#0A0A0A]">
                  <RatingStars rating={r.rating} />
                  <p className="mt-3 text-sm font-semibold text-saif-text">{r.title}</p>
                  <p className="mt-2 text-sm text-saif-dim leading-relaxed line-clamp-4">{r.body}</p>
                  <p className="mt-4 text-xs text-saif-dim uppercase tracking-wider">— {r.user?.full_name || 'Verified Customer'}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ HOW IT WORKS ============ */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 border-t border-saif-border">
        <div className="max-w-7xl mx-auto">
          <SectionHeading title="Ordering Takes 3 Minutes" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StepCard n="01" icon={<CreditCard size={20} />} title="Place your order" text="Pick your items, check out, and transfer the total via InstaPay or Vodafone Cash." />
            <StepCard n="02" icon={<BadgeCheck size={20} />} title="Upload your receipt" text="Attach the transfer screenshot — our team manually verifies every payment." />
            <StepCard n="03" icon={<Clock size={20} />} title="We confirm & ship" text="Once approved, physical orders ship out and digital orders get fulfilled." />
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="px-4 sm:px-6 lg:px-10 py-24 border-t border-saif-border text-center">
        <h2 className="text-[clamp(32px,6vw,64px)] font-black tracking-tighter text-saif-text leading-none">
          Ready when you are.
        </h2>
        <p className="mt-4 text-sm text-saif-dim">Browse the full catalog — streetwear, accessories and digital packages.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/products" className="btn btn-primary">Browse Everything</Link>
        </div>
      </section>
    </div>
  )
}

function TrustCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="border border-saif-border p-6 bg-[#0A0A0A]">
      <div className="text-saif-accent mb-4">{icon}</div>
      <h3 className="text-sm font-bold text-saif-text mb-2">{title}</h3>
      <p className="text-sm text-saif-dim leading-relaxed">{text}</p>
    </div>
  )
}

function StepCard({ n, icon, title, text }: { n: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="border border-saif-border p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-3xl font-black text-saif-accent/30">{n}</span>
        <span className="text-saif-accent">{icon}</span>
      </div>
      <h3 className="text-sm font-bold text-saif-text mb-2">{title}</h3>
      <p className="text-sm text-saif-dim leading-relaxed">{text}</p>
    </div>
  )
}
