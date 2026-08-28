export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
          role: Database['public']['Enums']['user_role']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          address?: Json | null
          role?: Database['public']['Enums']['user_role']
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          address?: Json | null
          updated_at?: string
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
          product_type: Database['public']['Enums']['product_type']
          category_id: string | null
          images: string[]
          thumbnail: string | null
          stock: number
          low_stock_threshold: number
          sku: string | null
          status: Database['public']['Enums']['product_status']
          featured: boolean
          bestseller: boolean
          tags: string[]
          specifications: Json
          delivery_info: string | null
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
          price?: number
          compare_at_price?: number | null
          product_type?: Database['public']['Enums']['product_type']
          category_id?: string | null
          images?: string[]
          thumbnail?: string | null
          stock?: number
          low_stock_threshold?: number
          sku?: string | null
          status?: Database['public']['Enums']['product_status']
          featured?: boolean
          bestseller?: boolean
          tags?: string[]
          specifications?: Json
          delivery_info?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          description?: string
          short_description?: string
          price?: number
          compare_at_price?: number | null
          product_type?: Database['public']['Enums']['product_type']
          category_id?: string | null
          images?: string[]
          thumbnail?: string | null
          stock?: number
          low_stock_threshold?: number
          sku?: string | null
          status?: Database['public']['Enums']['product_status']
          featured?: boolean
          bestseller?: boolean
          tags?: string[]
          specifications?: Json
          delivery_info?: string | null
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
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
        Update: {
          product_id?: string
          name?: string
          sku?: string | null
          price?: number | null
          stock?: number
          size?: string | null
          color?: string | null
          image?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          product_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      carts: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string | null
          session_id?: string | null
          updated_at?: string
        }
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
          created_at?: string
          updated_at?: string
        }
        Update: {
          cart_id?: string
          product_id?: string
          variant_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          order_number: string
          user_id: string
          status: Database['public']['Enums']['order_status']
          payment_status: Database['public']['Enums']['payment_status'] | null
          payment_method: Database['public']['Enums']['payment_method'] | null
          subtotal: number
          discount: number
          shipping_fee: number
          total: number
          coupon_code: string | null
          stock_reserved: boolean
          customer_name: string
          customer_email: string
          customer_phone: string | null
          shipping_address: Json
          notes: string | null
          internal_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          user_id: string
          status?: Database['public']['Enums']['order_status']
          payment_status?: Database['public']['Enums']['payment_status'] | null
          payment_method?: Database['public']['Enums']['payment_method'] | null
          subtotal?: number
          discount?: number
          shipping_fee?: number
          total?: number
          coupon_code?: string | null
          stock_reserved?: boolean
          customer_name: string
          customer_email: string
          customer_phone?: string | null
          shipping_address?: Json
          notes?: string | null
          internal_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          order_number?: string
          user_id?: string
          status?: Database['public']['Enums']['order_status']
          payment_status?: Database['public']['Enums']['payment_status'] | null
          payment_method?: Database['public']['Enums']['payment_method'] | null
          subtotal?: number
          discount?: number
          shipping_fee?: number
          total?: number
          coupon_code?: string | null
          stock_reserved?: boolean
          customer_name?: string
          customer_email?: string
          customer_phone?: string | null
          shipping_address?: Json
          notes?: string | null
          internal_note?: string | null
          updated_at?: string
        }
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
          product_type: string | null
          image: string | null
          price: number
          quantity: number
          total: number
          fulfillment_note: string | null
          fulfilled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          variant_id?: string | null
          product_name: string
          variant_name?: string | null
          product_type?: string
          image?: string | null
          price: number
          quantity: number
          total: number
          fulfillment_note?: string | null
          fulfilled_at?: string | null
          created_at?: string
        }
        Update: {
          order_id?: string
          product_id?: string
          variant_id?: string | null
          product_name?: string
          variant_name?: string | null
          product_type?: string
          image?: string | null
          price?: number
          quantity?: number
          total?: number
          fulfillment_note?: string | null
          fulfilled_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          order_id: string
          payment_method: Database['public']['Enums']['payment_method']
          payment_status: Database['public']['Enums']['payment_status']
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
        Insert: {
          id?: string
          order_id: string
          payment_method: Database['public']['Enums']['payment_method']
          payment_status?: Database['public']['Enums']['payment_status']
          expected_amount?: number
          transferred_amount?: number | null
          payer_identifier?: string | null
          screenshot_path?: string | null
          customer_note?: string | null
          admin_note?: string | null
          rejection_reason?: string | null
          verified_by?: string | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          order_id?: string
          payment_method?: Database['public']['Enums']['payment_method']
          payment_status?: Database['public']['Enums']['payment_status']
          expected_amount?: number
          transferred_amount?: number | null
          payer_identifier?: string | null
          screenshot_path?: string | null
          customer_note?: string | null
          admin_note?: string | null
          rejection_reason?: string | null
          verified_by?: string | null
          verified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_events: {
        Row: {
          id: string
          order_id: string
          event_type: string
          status: string | null
          payment_status: string | null
          message: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          event_type: string
          status?: string | null
          payment_status?: string | null
          message?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          order_id?: string
          event_type?: string
          status?: string | null
          payment_status?: string | null
          message?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
      inventory_logs: {
        Row: {
          id: string
          product_id: string
          variant_id: string | null
          change_type: string
          delta: number
          previous_value: number
          new_value: number
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          variant_id?: string | null
          change_type: string
          delta?: number
          previous_value?: number
          new_value?: number
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          product_id?: string
          variant_id?: string | null
          change_type?: string
          delta?: number
          previous_value?: number
          new_value?: number
          note?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          id: string
          code: string
          type: Database['public']['Enums']['coupon_type']
          value: number
          min_order_value: number | null
          max_uses: number | null
          uses_count: number
          max_discount_amount: number | null
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          type: Database['public']['Enums']['coupon_type']
          value?: number
          min_order_value?: number | null
          max_uses?: number | null
          uses_count?: number
          max_discount_amount?: number | null
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          code?: string
          type?: Database['public']['Enums']['coupon_type']
          value?: number
          min_order_value?: number | null
          max_uses?: number | null
          uses_count?: number
          max_discount_amount?: number | null
          expires_at?: string | null
          is_active?: boolean
        }
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
          status: Database['public']['Enums']['review_status']
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          rating: number
          title: string
          body: string
          status?: Database['public']['Enums']['review_status']
          created_at?: string
        }
        Update: {
          product_id?: string
          user_id?: string
          rating?: number
          title?: string
          body?: string
          status?: Database['public']['Enums']['review_status']
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
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
          min_order_amount: number | null
          payment_number: string | null
          instapay_enabled: boolean
          vodafone_cash_enabled: boolean
          payment_instructions: string | null
          hero_title: string | null
          hero_subtitle: string | null
          hero_image: string | null
          footer_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_name?: string
          store_description?: string
          logo_url?: string | null
          favicon_url?: string | null
          contact_email?: string
          contact_phone?: string | null
          social_links?: Json
          announcement?: string | null
          maintenance_mode?: boolean
          currency?: string
          shipping_fee?: number
          free_shipping_threshold?: number | null
          min_order_amount?: number | null
          payment_number?: string | null
          instapay_enabled?: boolean
          vodafone_cash_enabled?: boolean
          payment_instructions?: string | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image?: string | null
          footer_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          store_name?: string
          store_description?: string
          logo_url?: string | null
          favicon_url?: string | null
          contact_email?: string
          contact_phone?: string | null
          social_links?: Json
          announcement?: string | null
          maintenance_mode?: boolean
          currency?: string
          shipping_fee?: number
          free_shipping_threshold?: number | null
          min_order_amount?: number | null
          payment_number?: string | null
          instapay_enabled?: boolean
          vodafone_cash_enabled?: boolean
          payment_instructions?: string | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image?: string | null
          footer_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: Record<never, never>; Returns: boolean }
      validate_coupon: { Args: { p_code: string; p_subtotal: number }; Returns: string }
      get_product_rating_stats: {
        Args: Record<never, never>
        Returns: {
          product_id: string
          avg_rating: number | null
          review_count: number
        }[]
      }
      place_order: {
        Args: {
          p_customer: Json
          p_items: Json
          p_coupon_code?: string | null
          p_payment_method: string
          p_shipping?: Json | null
          p_notes?: string | null
        }
        Returns: string
      }
      submit_payment: {
        Args: {
          p_order_id: string
          p_payer_identifier: string
          p_transferred_amount: number
          p_screenshot_path: string
          p_customer_note?: string | null
        }
        Returns: string
      }
      review_payment: {
        Args: {
          p_payment_id: string
          p_decision: string
          p_admin_note?: string | null
          p_rejection_reason?: string | null
        }
        Returns: string
      }
      admin_update_order_status: {
        Args: { p_order_id: string; p_status: string; p_message?: string | null }
        Returns: undefined
      }
      admin_add_order_note: { Args: { p_order_id: string; p_note: string }; Returns: undefined }
      admin_set_fulfillment: { Args: { p_order_item_id: string; p_fulfillment_note: string }; Returns: undefined }
      customer_cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      admin_adjust_stock: {
        Args: {
          p_product_id: string
          p_variant_id?: string | null
          p_action: string
          p_value: number
          p_note?: string | null
        }
        Returns: string
      }
      admin_dashboard_stats: { Args: Record<never, never>; Returns: string }
      admin_sales_analytics: { Args: { p_days?: number }; Returns: string }
      admin_customer_stats: {
        Args: Record<never, never>
        Returns: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          created_at: string
          orders_count: number
          total_spent: number
          last_order_at: string | null
        }[]
      }
      search_suggestions: {
        Args: { p_query: string; p_limit?: number }
        Returns: {
          id: string
          name: string
          slug: string
          thumbnail: string | null
          price: number
          category_name: string | null
          product_type: string
        }[]
      }
    }
    Enums: {
      user_role: 'customer' | 'admin'
      product_type: 'physical' | 'digital'
      product_status: 'active' | 'draft' | 'archived'
      order_status:
        | 'pending'
        | 'payment_review'
        | 'confirmed'
        | 'processing'
        | 'shipped'
        | 'delivered'
        | 'completed'
        | 'cancelled'
        | 'refunded'
      payment_status:
        | 'awaiting_payment'
        | 'payment_submitted'
        | 'under_review'
        | 'approved'
        | 'rejected'
        | 'cancelled'
      payment_method: 'instapay' | 'vodafone_cash'
      coupon_type: 'percentage' | 'fixed'
      review_status: 'pending' | 'approved' | 'rejected'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type DatabasePublic = Database['public']
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
