import { useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { formatPrice, orderStatus, supabase, type Order } from './store'
import { Page } from './InfoPages'
import { navigate } from './routes'

type Props = {
  session: Session | null
  orders?: { list: Order[]; error: boolean }
  createdOrder?: string
  retry: () => void
  onCart: () => void
  hasCart: boolean
  returnTo?: 'cart' | 'support'
}

export function AccountPanel({ session, orders, createdOrder, retry, onCart, hasCart, returnTo }: Props) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'reset'>('sign-in')
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
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL('.', window.location.href).href })
        if (resetError) setError('We could not request a reset. Please try again.')
        else setMessage('If an account exists for this address, look for a reset link in your email.')
        return
      }
      const { data, error: authError } = mode === 'sign-up'
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL('.', window.location.href).href } })
        : await supabase.auth.signInWithPassword({ email, password })
      if (authError) setError(authError.message)
      else if (mode === 'sign-up' && !data.session) setMessage('Check your email for a confirmation link, then sign in.')
    } catch {
      setError('We could not connect. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function showMode(next: typeof mode) {
    setMode(next)
    setError('')
    setMessage('')
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
          <div><small>Signed in as</small><p>{session.user.email}</p></div>
          <button className="button button-ghost" type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {createdOrder && <p role="status">Order {createdOrder} was saved. No payment was collected.</p>}
        <p className="page-links"><a href="#/account/password">Change password</a>{returnTo === 'support' && <a href="#/support">Back to support</a>}</p>
        <h3>Recent orders</h3>
        {!orders && <p role="status">Loading orders…</p>}
        {orders?.error && <p role="alert">Could not load orders. <button className="text-link" onClick={retry}>Retry</button></p>}
        {orders && !orders.error && !orders.list.length && <p>You have no orders yet.</p>}
        <ul className="orders-list">
          {orders?.list.map((order) => (
            <li key={order.id}>
              <div className="order-history-heading"><strong className={`order-state state-${order.status}`}>{orderStatus[order.status]}</strong><strong>{formatPrice(order.subtotal_cents)} USD</strong></div>
              <time dateTime={order.created_at}>{new Date(order.created_at).toLocaleDateString()}</time>
              <p className="reference">Reference {order.id}</p>
              <ul>
                {order.order_items.map((item, index) => (
                  <li key={index}>{item.quantity} × {item.product_name} · {formatPrice(item.unit_price_cents)} each</li>
                ))}
              </ul>
              <a className="order-help-link" href={`#/support?order=${order.id}`}>Get help with this order</a>
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
      {mode !== 'reset' && <label>Password<input name="password" type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength={mode === 'sign-up' ? 8 : undefined} required /></label>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : { 'sign-in': 'Sign in', 'sign-up': 'Create account', reset: 'Request reset link' }[mode]}</button>
      <button className="button button-ghost" type="button" disabled={busy} onClick={() => showMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
        {mode === 'sign-in' ? 'Create an account' : 'Back to sign in'}
      </button>
      {mode === 'sign-in' && <button className="text-link" type="button" disabled={busy} onClick={() => showMode('reset')}>Forgot password?</button>}
    </form>
  )
}

export function PasswordPage({ session, authReady }: { session: Session | null; authReady: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session || busy) return
    const fields = new FormData(event.currentTarget)
    const password = String(fields.get('password') ?? '')
    if (password !== fields.get('confirm')) {
      setError('The passwords must match.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) setError(updateError.message)
      else navigate('#/account?password=updated')
    } catch {
      setError('Could not update the password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Change your password">
      <div className="page-card narrow-card">
        {!authReady ? <p role="status">Checking your sign-in…</p> : session ? (
          <form className="auth-form shop-dialog-body" onSubmit={(event) => void updatePassword(event)}>
            <label>New password<input type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
            <label>Confirm password<input type="password" name="confirm" autoComplete="new-password" minLength={8} required /></label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
          </form>
        ) : <p>Sign in or request a fresh reset link from <a href="#/account">My account</a>.</p>}
      </div>
    </Page>
  )
}
