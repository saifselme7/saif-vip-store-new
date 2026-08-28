import { Link } from 'react-router-dom'
import { Instagram, Twitter, Youtube, Mail, Phone, ArrowUpRight } from 'lucide-react'
import { useApp } from '@/context/AppContext'

const SOCIAL_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  x: Twitter,
  youtube: Youtube,
}

export default function Footer() {
  const { settings } = useApp()
  const socialLinks = (settings?.social_links ?? {}) as Record<string, string>
  const socialEntries = Object.entries(socialLinks).filter(([, url]) => !!url)

  return (
    <footer className="relative border-t border-saif-border pt-20 pb-10 px-5 lg:px-10 mt-4 overflow-hidden">
      {/* Ghost signature */}
      <span
        className="absolute -bottom-4 right-4 text-outline-faint text-[clamp(80px,14vw,200px)] font-black leading-none tracking-tighter select-none pointer-events-none"
        aria-hidden="true"
      >
        SAIF®
      </span>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-12 mb-16">
          <div className="col-span-2 md:col-span-1">
            <Link
              to="/"
              className="group flex items-baseline text-xl font-bold tracking-tight text-saif-text"
              aria-label="SAIF STORE home"
            >
              <span className="group-hover:text-saif-accent transition-colors duration-300">SAIF</span>
              <span className="font-light text-saif-dim group-hover:text-saif-text transition-colors duration-300">
                STORE
              </span>
              <sup className="text-[9px] font-normal text-saif-faint ml-0.5" aria-hidden="true">
                ®
              </sup>
            </Link>
            <p className="mt-5 text-sm text-saif-dim max-w-xs leading-relaxed text-balance">
              {settings?.store_description ||
                'Premium fashion and digital products. Carefully curated for the modern individual.'}
            </p>
            {socialEntries.length > 0 && (
              <div className="flex gap-2.5 mt-6">
                {socialEntries.map(([key, url]) => {
                  const Icon = SOCIAL_ICONS[key] ?? Mail
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${key} (opens in a new tab)`}
                      className="w-11 h-11 border border-saif-border flex items-center justify-center text-saif-dim hover:text-black hover:bg-saif-accent hover:border-saif-accent transition-all duration-300 rounded-sm"
                    >
                      <Icon size={15} />
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          <nav aria-label="Shop links">
            <h4 className="text-[11px] font-semibold text-saif-text mb-5 tracking-[0.2em] uppercase">Shop</h4>
            <ul className="space-y-1">
              {[
                ['All Products', '/products'],
                ['Streetwear', '/products?type=physical'],
                ['Digital Products', '/products?type=digital'],
                ['Special Offers', '/products?onSale=true'],
                ['Best Sellers', '/products?bestseller=true'],
              ].map(([label, to]) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="inline-flex items-center gap-1.5 min-h-[44px] md:min-h-[36px] text-sm text-saif-dim hover:text-saif-text transition-colors py-2 md:py-1"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Support links">
            <h4 className="text-[11px] font-semibold text-saif-text mb-5 tracking-[0.2em] uppercase">Support</h4>
            <ul className="space-y-1">
              {[
                ['Shipping & Returns', '/shipping'],
                ['FAQ', '/faq'],
                ['Contact', '/contact'],
                ['About', '/about'],
                ['Track Order', '/orders'],
              ].map(([label, to]) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="inline-flex items-center gap-1.5 min-h-[44px] md:min-h-[36px] text-sm text-saif-dim hover:text-saif-text transition-colors py-2 md:py-1"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h4 className="text-[11px] font-semibold text-saif-text mb-5 tracking-[0.2em] uppercase">Get in Touch</h4>
            <ul className="space-y-1">
              {settings?.contact_email && (
                <li>
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="inline-flex items-center gap-2.5 min-h-[44px] md:min-h-[36px] text-sm text-saif-dim hover:text-saif-text transition-colors py-2 md:py-1"
                  >
                    <Mail size={13} className="text-saif-accent" aria-hidden="true" />
                    {settings.contact_email}
                  </a>
                </li>
              )}
              {settings?.contact_phone && (
                <li>
                  <a
                    href={`tel:${settings.contact_phone}`}
                    className="inline-flex items-center gap-2.5 min-h-[44px] md:min-h-[36px] text-sm text-saif-dim hover:text-saif-text transition-colors py-2 md:py-1"
                  >
                    <Phone size={13} className="text-saif-accent" aria-hidden="true" />
                    <span dir="ltr">{settings.contact_phone}</span>
                  </a>
                </li>
              )}
              <li className="text-sm text-saif-dim leading-relaxed pt-2 max-w-[16rem]">
                Payments verified manually via InstaPay & Vodafone Cash.
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-saif-border pt-8 flex flex-col-reverse md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-saif-faint">
            {settings?.footer_text || `© ${new Date().getFullYear()} SAIF STORE. All rights reserved.`}
          </p>
          <div className="flex gap-7">
            <Link
              to="/privacy"
              className="inline-flex items-center gap-1 text-xs text-saif-dim hover:text-saif-text transition-colors min-h-[44px] md:min-h-0 py-2 md:py-0"
            >
              Privacy
              <ArrowUpRight size={11} className="text-saif-faint" aria-hidden="true" />
            </Link>
            <Link
              to="/terms"
              className="inline-flex items-center gap-1 text-xs text-saif-dim hover:text-saif-text transition-colors min-h-[44px] md:min-h-0 py-2 md:py-0"
            >
              Terms
              <ArrowUpRight size={11} className="text-saif-faint" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
