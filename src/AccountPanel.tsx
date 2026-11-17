import { useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { formatPrice, orderStatus, supabase, type Order } from './store'

type Props = {
  session: Session | null
  orders?: { list: Order[]; error: boolean }
  createdOrder?: string
  retry: () => void
  onCart: () => void
  hasCart: boolean
}

export function AccountPanel({ session, orders, createdOrder, retry, onCart, hasCart }: Props) {
  const [signUp, setSignUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    const fields = new FormData(event.currentTarget)
    const email = String(fields.get('email') ?? '').trim()
    const password = String(fields.get('password') ?? '')
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { data, error: authError } = signUp
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL('.', window.location.href).href } })
        : await supabase.auth.signInWithPassword({ email, password })
      if (authError) setError(authError.message)
      else if (signUp && !data.session) setMessage('Check your email for a confirmation link, then sign in.')
    } catch {
      setError('We could not connect. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) setError('Could not sign out. Please try again.')
    } catch {
      setError('Could not sign out. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!supabase) return <p className="shop-dialog-body">The account service is unavailable.</p>

  if (session) {
    return (
      <div className="shop-dialog-body">
        <div className="account-summary">
          <p>{session.user.email}</p>
          <button className="button button-ghost" type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {createdOrder && <p role="status">Order {createdOrder} was saved. No payment was collected.</p>}
        <h3>Recent orders</h3>
        {!orders && <p role="status">Loading orders…</p>}
        {orders?.error && <p role="alert">Could not load orders. <button className="text-link" onClick={retry}>Retry</button></p>}
        {orders && !orders.error && !orders.list.length && <p>You have no orders yet.</p>}
        <ul className="orders-list">
          {orders?.list.map((order) => (
            <li key={order.id}>
              <div><strong>{orderStatus[order.status]}</strong> · {formatPrice(order.subtotal_cents)} USD</div>
              <time dateTime={order.created_at}>{new Date(order.created_at).toLocaleDateString()}</time>
              <ul>
                {order.order_items.map((item, index) => (
                  <li key={index}>{item.quantity} × {item.product_name} · {formatPrice(item.unit_price_cents)} each</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {hasCart && <button className="button button-primary" type="button" onClick={onCart}>Back to cart</button>}
      </div>
    )
  }

  return (
    <form className="shop-dialog-body auth-form" onSubmit={(event) => void authenticate(event)}>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete={signUp ? 'new-password' : 'current-password'} minLength={signUp ? 8 : undefined} required /></label>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'}</button>
      <button className="button button-ghost" type="button" disabled={busy} onClick={() => { setSignUp(!signUp); setError(''); setMessage('') }}>
        {signUp ? 'I already have an account' : 'Create an account'}
      </button>
    </form>
  )
}
