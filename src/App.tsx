import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import { AppProvider, useApp } from '@/context/AppContext'
import { WishlistProvider } from '@/context/WishlistContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toasts from '@/components/Toasts'
import CartDrawer from '@/components/CartDrawer'
import CursorFollower from '@/components/CursorFollower'
import ProtectedRoute from '@/components/ProtectedRoute'
import Loading from '@/components/Loading'

// Storefront pages (eager)
import HomePage from '@/pages/HomePage'
import ProductsPage from '@/pages/ProductsPage'
import ProductDetailPage from '@/pages/ProductDetailPage'
import CartPage from '@/pages/CartPage'
import CheckoutPage from '@/pages/CheckoutPage'
import OrderConfirmationPage from '@/pages/OrderConfirmationPage'
import OrderDetailPage from '@/pages/OrderDetailPage'
import OrdersPage from '@/pages/OrdersPage'
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

// Admin pages (code-split — the dashboard never slows the storefront)
import AdminLayout from '@/components/admin/AdminLayout'
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'))
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'))
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'))
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'))
const AdminCoupons = lazy(() => import('@/pages/admin/AdminCoupons'))
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'))
const AdminInventory = lazy(() => import('@/pages/admin/AdminInventory'))
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <WishlistProvider>
            <CartProvider>
              <Shell />
            </CartProvider>
          </WishlistProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

function Shell() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {!isAdmin && <Header />}
      <Toasts />
      {!isAdmin && <CursorFollower />}
      {!isAdmin && <CartDrawer />}
      {!isAdmin && <MaintenanceBanner />}

      <div className="flex-1">
        <Suspense fallback={<div className="pt-20"><Loading /></div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders/:id/confirmation" element={<OrderConfirmationPage />} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/shipping" element={<ShippingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />

            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>

      {!isAdmin && <Footer />}
    </div>
  )
}

function MaintenanceBanner() {
  const { settings } = useApp()
  if (!settings?.maintenance_mode) return null
  return (
    <div className="bg-yellow-500/10 border-y border-yellow-500/30 text-yellow-300 text-center text-xs font-medium py-2 px-4">
      The store is under maintenance — browsing works, checkout may be briefly unavailable.
    </div>
  )
}
