import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Page } from './InfoPages'
import { supabase } from './store'

type Request = {
  id: string
  subject: string
  status: 'received' | 'in_review' | 'resolved'
  created_at: string
}

const statuses: Record<Request['status'], string> = {
  received: 'Received',
  in_review: 'In review',
  resolved: 'Resolved',
}

function Requests({ orderRef }: { orderRef?: string }) {
  const [list, setList] = useState<Request[] | null>(null)
  const [listError, setListError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const submission = useRef<{ id: string; subject: string; message: string } | null>(null)

  useEffect(() => {
    if (!supabase) return
    const abort = new AbortController()
    void supabase.from('support_requests').select('id,subject,status,created_at')
      .order('created_at', { ascending: false }).limit(20).returns<Request[]>()
      .abortSignal(abort.signal).then(({ data, error: loadError }) => {
        if (abort.signal.aborted) return
        setList(data ?? [])
        setListError(Boolean(loadError))
      })
    return () => abort.abort()
  }, [refresh])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || sending) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const subject = String(fields.get('subject') ?? '').trim()
    const message = String(fields.get('message') ?? '').trim()
    setError('')
    setResult('')
    if (subject.length < 4 || message.length < 10) {
      setError('Enter at least 4 characters for the subject and 10 for the message.')
      return
    }
    setSending(true)
    try {
      if (submission.current?.subject !== subject || submission.current.message !== message) {
        submission.current = { id: window.crypto.randomUUID(), subject, message }
      }
      const ticket = submission.current
      const { error: insertError } = await supabase.from('support_requests').insert(ticket)
      if (insertError) {
        if (insertError.code !== '23505') throw insertError
        const { data } = await supabase.from('support_requests').select('id').eq('id', ticket.id).maybeSingle()
        if (!data) throw insertError
      }
      setResult(`Request received. Reference ${ticket.id}`)
      submission.current = null
      form.reset()
      setRefresh((value) => value + 1)
    } catch {
      setError('We could not confirm your request. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page-columns support-requests">
      <div className="page-card">
        <h2>Send a support request</h2>
        <form className="shop-dialog-body auth-form" onSubmit={(event) => void submit(event)}>
          <p className="cart-status">Include the order reference if relevant. Leave out payment details, passwords and gift codes.</p>
          <label>Subject<input name="subject" minLength={4} maxLength={120} required /></label>
          <label>Message<textarea name="message" rows={5} minLength={10} maxLength={2000} defaultValue={orderRef ? `Order reference: ${orderRef}\n\n` : ''} required /></label>
          {error && <p role="alert">{error}</p>}
          {result && <p role="status">{result}</p>}
          <button className="button button-primary" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send request'}</button>
        </form>
      </div>
      <div className="page-card">
        <h2>Your requests</h2>
        {!list && <p role="status">Loading requests…</p>}
        {listError && <p role="alert">Could not load requests. <button className="text-link" onClick={() => setRefresh((value) => value + 1)}>Retry</button></p>}
        {list && !listError && list.length === 0 && <p>You have no requests yet.</p>}
        <ul className="orders-list">
          {list?.map((item) => (
            <li key={item.id}>
              <strong>{item.subject}</strong>
              <p>{statuses[item.status]} · <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time></p>
              <small className="reference">Reference {item.id}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function SupportPage({ userId, authReady, orderRef }: { userId?: string; authReady: boolean; orderRef?: string }) {
  const order = orderRef && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orderRef) ? orderRef : undefined
  return (
    <Page title="Support center" className="support-page" intro="Find an answer, look up an order or send us a private request.">
      <div className="support-topics">
        <a href="#/account"><strong>Find an order</strong><span>See its status and find the order reference.</span></a>
        <a href="#/faq"><strong>Read the FAQ</strong><span>Answers about products, account access and saving orders.</span></a>
      </div>
      {!authReady ? <p role="status">Checking your sign-in…</p> : userId ? <Requests key={`${userId}:${order ?? ''}`} orderRef={order} /> : (
        <div className="support-guest">
          <div><h2>Send a support request</h2><p>Sign in to send a private message and track its status here.</p><a className="button button-primary" href="#/account?returnTo=support">Sign in for support</a></div>
          <aside><h3>Before you write</h3><ul><li>Include your order reference if you have one.</li><li>Tell us the product name and what happened.</li><li>Keep passwords and gift codes private.</li></ul></aside>
        </div>
      )}
    </Page>
  )
}
