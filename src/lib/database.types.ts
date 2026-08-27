export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type OrderStatus =
  | 'pending'
  | 'payment_review'
  | 'confirmed'
  | 'processing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'refunded'

export type PaymentStatus = 'awaiting_payment' | 'under_review' | 'approved' | 'rejected' | 'cancelled'
export type PaymentMethod = 'instapay' | 'vodafone_cash'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          address: Json | null
          role: 'customer' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          address?: Json | null
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          address?: Json | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          image: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          image?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          slug?: string
          description?: string | null
          image?: string | null
          sort_order?: number
          is_active?: boolean
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          description: string
          short_description: string
          price: number
          compare_at_price: number | null
          product_type: 'physical' | 'digital'
          category_id: string | null
          images: string[]
          thumbnail: string | null
          stock: number
          low_stock_threshold: number
          sku: string | null
          status: 'active' | 'draft' | 'archived'
          featured: boolean
          bestseller: boolean
          tags: string[]
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string
          short_description?: string
          price: number
          compare_at_price?: number | null
          product_type?: 'physical' | 'digital'
          category_id?: string | null
          images?: string[]
          thumbnail?: string | null
          stock?: number
          low_stock_threshold?: number
          sku?: string | null
          status?: 'active' | 'draft' | 'archived'
          featured?: boolean
          bestseller?: boolean
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          }
        ]
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          name: string
          sku: string | null
          price: number | null
          stock: number
          size: string | null
          color: string | null
          image: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          sku?: string | null
          price?: number | null
          stock?: number
          size?: string | null
          color?: string | null
          image?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['product_variants']['Insert']> & { id?: string }
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      wishlists: {
        Row: { id: string; user_id: string; product_id: string; created_at: string }
        Insert: { id?: string; user_id: string; product_id: string; created_at?: string }
        Update: { product_id?: string }
        Relationships: [
          {
            foreignKeyName: 'wishlists_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      carts: {
        Row: { id: string; user_id: string | null; session_id: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id?: string | null; session_id?: string | null }
        Update: { user_id?: string | null; session_id?: string | null }
        Relationships: []
      }
      cart_items: {
        Row: {
          id: string
          cart_id: string
          product_id: string
          variant_id: string | null
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cart_id: string
          product_id: string
          variant_id?: string | null
          quantity?: number
        }
        Update: { quantity?: number; variant_id?: string | null }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          order_number: string
          user_id: string
          status: OrderStatus
          subtotal: number
          discount: number
          shipping_fee: number
          total: number
          coupon_code: string | null
          payment_method: PaymentMethod | null
          customer_name: string
          customer_email: string
          customer_phone: string | null
          shipping_address: Json | null
          notes: string | null
          digital_delivery: Json
          stock_released: boolean
          created_at: string
          updated_at: string
        }
        Insert: never // orders are created exclusively via the place_order RPC
        Update: { status?: OrderStatus; notes?: string | null; digital_delivery?: Json }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          variant_id: string | null
          product_name: string
          variant_name: string | null
          product_type: 'physical' | 'digital'
          price: number
          quantity: number
          total: number
          created_at: string
        }
        Insert: never // created inside the place_order RPC
        Update: Partial<Database['public']['Tables']['order_items']['Row']>
        Relationships: [
          {
            foreignKeyName: 'order_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      payments: {
        Row: {
          id: string
          order_id: string
          user_id: string
          payment_method: PaymentMethod
          status: PaymentStatus
          expected_amount: number
          transferred_amount: number | null
          payer_identifier: string | null
          screenshot_path: string | null
          customer_note: string | null
          admin_note: string | null
          rejection_reason: string | null
          verified_by: string | null
          verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: never // created exclusively via the submit_payment RPC
        Update: never // mutated exclusively via the review_payment RPC
        Relationships: [
          {
            foreignKeyName: 'payments_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      coupons: {
        Row: {
          id: string
          code: string
          type: 'percentage' | 'fixed'
          value: number
          min_order_value: number | null
          max_discount: number | null
          max_uses: number | null
          uses_count: number
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          type: 'percentage' | 'fixed'
          value: number
          min_order_value?: number | null
          max_discount?: number | null
          max_uses?: number | null
          uses_count?: number
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['coupons']['Insert']> & { id?: string }
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          product_id: string
          user_id: string
          rating: number
          title: string
          body: string
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          rating: number
          title: string
          body: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
        Update: { status?: 'pending' | 'approved' | 'rejected' }
        Relationships: [
          {
            foreignKeyName: 'reviews_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      site_settings: {
        Row: {
          id: string
          store_name: string
          store_description: string
          logo_url: string | null
          favicon_url: string | null
          contact_email: string
          contact_phone: string | null
          social_links: Json
          announcement: string | null
          maintenance_mode: boolean
          currency: string
          shipping_fee: number
          free_shipping_threshold: number | null
          minimum_order_amount: number | null
          payment_number: string
          hero_title: string | null
          hero_subtitle: string | null
          hero_image: string | null
          footer_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['site_settings']['Row']>
        Update: Partial<Database['public']['Tables']['site_settings']['Row']>
        Relationships: []
      }
      inventory_log: {
        Row: {
          id: string
          product_id: string | null
          variant_id: string | null
          change: number
          stock_after: number
          changed_by: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'inventory_log_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      validate_coupon: {
        Args: { p_code: string; p_subtotal: number }
        Returns: Json
      }
      place_order: {
        Args: { p_items: Json; p_coupon_code: string | null; p_customer: Json; p_payment_method: string }
        Returns: Json
      }
      submit_payment: {
        Args: {
          p_order_id: string
          p_payment_method: string
          p_transferred_amount: number
          p_payer_identifier: string
          p_screenshot_path: string
          p_customer_note?: string | null
        }
        Returns: Json
      }
      review_payment: {
        Args: { p_payment_id: string; p_action: string; p_admin_note?: string | null; p_rejection_reason?: string | null }
        Returns: Json
      }
      set_order_status: { Args: { p_order_id: string; p_status: string }; Returns: undefined }
      get_order_digital_delivery: { Args: { p_order_id: string }; Returns: Json }
      get_analytics_summary: { Args: Record<string, never>; Returns: Json }
      get_customer_stats: {
        Args: Record<string, never>
        Returns: { user_id: string; order_count: number; total_spent: number; last_order_at: string | null }[]
      }
      set_user_role: { Args: { p_user_id: string; p_role: string }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
