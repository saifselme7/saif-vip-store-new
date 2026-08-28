import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import { AppProvider, useApp } from '@/context/AppContext'
import { ToastProvider } from '@/context/ToastContext'
import { LanguageProvider } from '@/i18n'
import { useAuth } from '@/context/AuthContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toasts from '@/components/Toasts'
import CursorFollower from '@/components/CursorFollower'
import ProtectedRoute from '@/components/ProtectedRoute'
import ScrollToTop from '@/components/ScrollToTop'
import CartDrawer from '@/components/CartDrawer'
import Loading from '@/components/Loading'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import ErrorBoundary from '@/components/ErrorBoundary'
import HomePage from '@/pages/HomePage'
import ProductsPage from '@/pages/ProductsPage'
import ProductDetailPage from '@/pages/ProductDetailPage'
import CartPage from '@/pages/CartPage'
import CheckoutPage from '@/pages/CheckoutPage'
import OrderConfirmationPage from '@/pages/OrderConfirmationPage'
import OrdersPage from '@/pages/OrdersPage'
import OrderDetailPage from '@/pages/OrderDetailPage'
import AccountPage from '@/pages/AccountPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import WishlistPage from '@/pages/WishlistPage'
import SearchPage from '@/pages/SearchPage'
import AboutPage from '@/pages/AboutPage'
import ContactPage from '@/pages/ContactPage'
import FAQPage from '@/pages/FAQPage'
import ShippingPage from '@/pages/ShippingPage'
import PrivacyPage from '@/pages/PrivacyPage'
import TermsPage from '@/pages/TermsPage'
import NotFoundPage from '@/pages/NotFoundPage'

// Admin routes are code-split: storefront visitors never download them.
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'))
const AdminProductForm = lazy(() => import('@/pages/admin/AdminProductForm'))
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'))
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail'))
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'))
const AdminInventory = lazy(() => import('@/pages/admin/AdminInventory'))
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'))
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'))
const AdminCoupons = lazy(() => import('@/pages/admin/AdminCoupons'))
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'))
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))
const AdminSiteBuilder = lazy(() => import('@/pages/admin/AdminSiteBuilder'))

function AdminFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Loading />
    </div>
  )
}

function StorefrontGate({ children }: { children: React.ReactNode }) {
  const { settings, settingsLoading } = useApp()
  const { isAdmin, loading: authLoading } = useAuth()

  if (settingsLoading || authLoading) return <>{children}</>
  if (settings?.maintenance_mode && !isAdmin) return <MaintenanceScreen />
  return <>{children}</>
}

/**
 * Storefront chrome (header, cart drawer, cursor) is hidden on admin routes:
 * the admin dashboard has its own layout and must not sit under the fixed
 * storefront header.
 */
function StorefrontChrome() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/admin')) return null
  return (
    <>
      <Header />
      <CartDrawer />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <CartProvider>
              <StorefrontGate>
                <StorefrontChrome />
                <Toasts />
                <CursorFollower />
                <ScrollToTop />
                <main id="main">
                  <ErrorBoundary>
                  <Suspense fallback={<div className="pt-28"><Loading /></div>}>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/products/:slug" element={<ProductDetailPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                      <Route path="/orders/:id/confirmation" element={<ProtectedRoute><OrderConfirmationPage /></ProtectedRoute>} />
                      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                      <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
                      <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                      <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/faq" element={<FAQPage />} />
                      <Route path="/shipping" element={<ShippingPage />} />
                      <Route path="/privacy" element={<PrivacyPage />} />
                      <Route path="/terms" element={<TermsPage />} />

                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute adminOnly>
                            <Suspense fallback={<AdminFallback />}>
                              <AdminLayout />
                            </Suspense>
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<AdminDashboard />} />
                        <Route path="products" element={<AdminProducts />} />
                        <Route path="products/new" element={<AdminProductForm />} />
                        <Route path="products/:id/edit" element={<AdminProductForm />} />
                        <Route path="orders" element={<AdminOrders />} />
                        <Route path="orders/:id" element={<AdminOrderDetail />} />
                        <Route path="payments" element={<AdminPayments />} />
                        <Route path="inventory" element={<AdminInventory />} />
                        <Route path="categories" element={<AdminCategories />} />
                        <Route path="customers" element={<AdminCustomers />} />
                        <Route path="coupons" element={<AdminCoupons />} />
                        <Route path="reviews" element={<AdminReviews />} />
                        <Route path="analytics" element={<AdminAnalytics />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="site" element={<AdminSiteBuilder />} />
                      </Route>

                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                  </ErrorBoundary>
                </main>
              </StorefrontGate>
            </CartProvider>
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
