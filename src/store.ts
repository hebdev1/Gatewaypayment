import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && publishableKey ? createClient(url, publishableKey) : null

export type Product = {
  id: string
  name: string
  type: string
  category: 'Top-ups' | 'Gift cards' | 'Game codes' | 'Subscriptions'
  mark: string
  tone: string
  price: number
  tag: string
}

export type Order = {
  id: string
  subtotal_cents: number
  status: 'awaiting_payment' | 'paid' | 'fulfilled' | 'cancelled'
  created_at: string
  order_items: { product_name: string; quantity: number; unit_price_cents: number }[]
}

export const orderStatus: Record<Order['status'], string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const formatPrice = (cents: number) => usd.format(cents / 100)

export function fetchProducts(client: NonNullable<typeof supabase>) {
  return client.from('products').select('id,name,type,category,mark,tone,price,tag')
    .eq('active', true).order('sort_order').order('id').returns<Product[]>()
}

export function fetchOrders(client: NonNullable<typeof supabase>) {
  return client.from('orders')
    .select('id,subtotal_cents,status,created_at,order_items(product_name,quantity,unit_price_cents)')
    .order('created_at', { ascending: false }).limit(50).returns<Order[]>()
}
