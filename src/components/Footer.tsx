import { Link } from 'react-router-dom'
import { Smartphone, Wallet } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useCategories } from '@/hooks/useCategories'

export default function Footer() {
  const { settings } = useApp()
  const { categories } = useCategories()

  return (
    <footer className="border-t border-saif-border mt-20 pt-16 pb-8 px-6 lg:px-10 bg-[#050505]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-14">
          {/* Brand */}
          <div className="md:col-span-5">
            <Link to="/" className="text-2xl font-black tracking-tighter text-saif-text">
              SAIF<span className="text-saif-accent">.</span>STORE<sup className="text-[10px] font-normal ml-0.5">®</sup>
            </Link>
            <p className="mt-4 text-sm text-saif-dim max-w-sm leading-relaxed">
              {settings?.store_description || 'Premium streetwear and digital products. Carefully curated.'}
            </p>
            <div className="mt-6 flex items-center gap-3 text-xs text-saif-dim">
              <span className="border border-saif-border px-3 py-1.5 flex items-center gap-1.5">
                <Smartphone size={12} /> InstaPay
              </span>
              <span className="border border-saif-border px-3 py-1.5 flex items-center gap-1.5">
                <Wallet size={12} /> Vodafone Cash
              </span>
            </div>
          </div>

          {/* Shop */}
          <div className="md:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-saif-text mb-4">Shop</h4>
            <ul className="space-y-2.5">
              <li><FooterLink to="/products">All Products</FooterLink></li>
              <li><FooterLink to="/products?type=physical">Streetwear</FooterLink></li>
              <li><FooterLink to="/products?type=digital">Digital</FooterLink></li>
              <li><FooterLink to="/products?sale=1">Offers</FooterLink></li>
            </ul>
          </div>

          {/* Categories */}
          <div className="md:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-saif-text mb-4">Categories</h4>
            <ul className="space-y-2.5">
              {categories.slice(0, 5).map(cat => (
                <li key={cat.id}>
                  <FooterLink to={`/products?category=${cat.id}`}>{cat.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-saif-text mb-4">Support</h4>
            <ul className="space-y-2.5">
              <li><FooterLink to="/shipping">Shipping & Payments</FooterLink></li>
              <li><FooterLink to="/faq">FAQ</FooterLink></li>
              <li><FooterLink to="/contact">Contact</FooterLink></li>
              <li><FooterLink to="/about">About</FooterLink></li>
            </ul>
            {settings?.contact_phone && (
              <p className="mt-4 text-xs text-saif-dim">
                Payments & support: <span dir="ltr" className="text-saif-text font-medium">{settings.contact_phone}</span>
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-saif-border pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-saif-dim">
            {settings?.footer_text || `© ${new Date().getFullYear()} ${settings?.store_name || 'SAIF STORE'}. All rights reserved.`}
          </p>
          <div className="flex gap-6">
            <FooterLink to="/privacy">Privacy</FooterLink>
            <FooterLink to="/terms">Terms</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm text-saif-dim hover:text-saif-text transition-colors">
      {children}
    </Link>
  )
}
