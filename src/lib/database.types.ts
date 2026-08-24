export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          address: Record<string, any> | null
          role: 'customer' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          address?: Record<string, any> | null
          role?: 'customer' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          address?: Record<string, any> | null
          role?: 'customer' | 'admin'
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_user_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'reviews'
            referencedColumns: ['user_id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['category_id']
          }
        ]
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
          sku: string | null
          status: 'active' | 'draft' | 'archived'
          featured: boolean
          bestseller: boolean
          tags: string[]
          metadata: Record<string, any>
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
          sku?: string | null
          status?: 'active' | 'draft' | 'archived'
          featured?: boolean
          bestseller?: boolean
          tags?: string[]
          metadata?: Record<string, any>
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
          product_type?: 'physical' | 'digital'
          category_id?: string | null
          images?: string[]
          thumbnail?: string | null
          stock?: number
          sku?: string | null
          status?: 'active' | 'draft' | 'archived'
          featured?: boolean
          bestseller?: boolean
          tags?: string[]
          metadata?: Record<string, any>
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
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['product_id']
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
        Update: {
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
          }
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
        Update: {}
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
        Relationships: [
          {
            foreignKeyName: 'cart_items_cart_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'cart_items'
            referencedColumns: ['cart_id']
          }
        ]
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
          quantity?: number
          variant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cart_items_cart_id_fkey'
            columns: ['cart_id']
            isOneToOne: false
            referencedRelation: 'carts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cart_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cart_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          }
        ]
      }
      orders: {
        Row: {
          id: string
          order_number: string
          user_id: string
          status: string
          subtotal: number
          discount: number
          total: number
          coupon_code: string | null
          customer_name: string
          customer_email: string
          customer_phone: string | null
          shipping_address: Record<string, any> | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          user_id: string
          status?: string
          subtotal?: number
          discount?: number
          total?: number
          coupon_code?: string | null
          customer_name: string
          customer_email: string
          customer_phone?: string | null
          shipping_address?: Record<string, any> | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          subtotal?: number
          discount?: number
          total?: number
          coupon_code?: string | null
          customer_name?: string
          customer_email?: string
          customer_phone?: string | null
          shipping_address?: Record<string, any> | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'order_items'
            referencedColumns: ['order_id']
          }
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          variant_id: string | null
          product_name: string
          variant_name: string | null
          price: number
          quantity: number
          total: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          variant_id?: string | null
          product_name: string
          variant_name?: string | null
          price: number
          quantity: number
          total: number
          created_at?: string
        }
        Update: {}
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          }
        ]
      }
      coupons: {
        Row: {
          id: string
          code: string
          type: string
          value: number
          min_order_value: number | null
          max_uses: number | null
          uses_count: number
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          type: string
          value: number
          min_order_value?: number | null
          max_uses?: number | null
          uses_count?: number
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          code?: string
          type?: string
          value?: number
          min_order_value?: number | null
          max_uses?: number | null
          uses_count?: number
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
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id: string
          rating: number
          title: string
          body: string
          status?: string
          created_at?: string
        }
        Update: {
          rating?: number
          title?: string
          body?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reviews_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
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
          social_links: Record<string, string>
          announcement: string | null
          maintenance_mode: boolean
          currency: string
          shipping_fee: number
          free_shipping_threshold: number | null
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
          social_links?: Record<string, string>
          announcement?: string | null
          maintenance_mode?: boolean
          currency?: string
          shipping_fee?: number
          free_shipping_threshold?: number | null
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
          social_links?: Record<string, string>
          announcement?: string | null
          maintenance_mode?: boolean
          currency?: string
          shipping_fee?: number
          free_shipping_threshold?: number | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image?: string | null
          footer_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
