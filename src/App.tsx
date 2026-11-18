import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AccountPanel, PasswordPage } from './AccountPanel'
import { AboutPage, FaqPage, Page, PrivacyPage, TermsPage } from './InfoPages'
import { SupportPage } from './SupportPage'
import { getProductDetails } from './productDetails'
import { catalogLink, navigate, readRoute } from './routes'
import { fetchOrders, fetchProducts, formatPrice, supabase, type Order, type Product } from './store'

type IconName =
  | 'arrow'
  | 'bag'
  | 'bolt'
  | 'chevron'
  | 'compass'
  | 'gamepad'
  | 'gift'
  | 'globe'
  | 'headset'
  | 'menu'
  | 'search'
  | 'shield'
  | 'spark'
  | 'trophy'
  | 'user'
  | 'wallet'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    bag: <><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    bolt: <path d="m13 2-8 11h7l-1 9 8-12h-7l1-8Z" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 4-4 2 2-4 4-2Z" /></>,
    gamepad: <><path d="M7.5 8h9a5.5 5.5 0 0 1 5.2 7.3l-1 2.8a2.8 2.8 0 0 1-4.5 1.1L14.8 18H9.2l-1.4 1.2a2.8 2.8 0 0 1-4.5-1.1l-1-2.8A5.5 5.5 0 0 1 7.5 8Z" /><path d="M7 12v4M5 14h4M17 13h.01M19 15h.01" /></>,
    gift: <><path d="M3 10h18v11H3zM2 7h20v4H2zM12 7v14" /><path d="M12 7H7.5A2.5 2.5 0 1 1 10 4.5L12 7Zm0 0h4.5A2.5 2.5 0 1 0 14 4.5L12 7Z" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M4 14h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2Zm16 0h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Z" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
    spark: <path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" />,
    trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM10 17h4M12 13v4M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M7 21h10" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    wallet: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H19v16H5.5A2.5 2.5 0 0 1 3 17.5v-11Z" /><path d="M3 7h16M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const categories = [
  { label: 'Top-ups', detail: 'In-game currency', icon: 'bolt' as IconName },
  { label: 'Gift cards', detail: 'Store and wallet credit', icon: 'gift' as IconName },
  { label: 'Game codes', detail: 'PC & console', icon: 'gamepad' as IconName },
  { label: 'Subscriptions', detail: 'Memberships', icon: 'spark' as IconName },
] as const

type Category = 'All' | (typeof categories)[number]['label']
type Cart = Partial<Record<string, number>>

const cartStorageKey = 'gaming-entertainment-ecosystem.cart'

function loadCart(): Cart {
  try {
    const saved = JSON.parse(window.localStorage.getItem(cartStorageKey) ?? '{}') as Cart | null
    return Object.fromEntries(Object.entries(saved ?? {}).filter(([, quantity]) =>
      typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 99
    ))
  } catch {
    return {}
  }
}

function AppButton({ children, variant = 'primary', onClick, ariaLabel, expanded, disabled }: { children: ReactNode; variant?: 'primary' | 'ghost' | 'icon' | 'dark'; onClick?: () => void; ariaLabel?: string; expanded?: boolean; disabled?: boolean }) {
  return <button type="button" className={`button button-${variant}`} onClick={onClick} aria-label={ariaLabel} aria-expanded={expanded} disabled={disabled}>{children}</button>
}

const catalogScenes: Record<string, string> = {
  'free-fire': '0% 0%',
  'pubg-mobile': '100% 0%',
  'call-of-duty': '0% 33.333%',
  'mobile-legends': '100% 33.333%',
  roblox: '0% 66.667%',
  valorant: '100% 66.667%',
  steam: '0% 100%',
  playstation: '100% 100%',
}

function ProductArt({ product }: { product: Product }) {
  const scene = catalogScenes[product.id]
  return (
    <>
      <span className={`art-bg tone-${product.tone}`} />
      {scene ? (
        <span className="product-scene" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}catalog-art.webp)`, backgroundPosition: scene }} />
      ) : (
        <><span className="art-noise" /><strong>{product.mark}</strong></>
      )}
    </>
  )
}

function routeCategory(value: string | null): Category {
  return categories.find((category) => category.label === value)?.label ?? 'All'
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [search, setSearch] = useState(() => route.params.get('q') ?? '')
  const [sort, setSort] = useState('featured')
  const [quantity, setQuantity] = useState(1)
  const activeCategory = routeCategory(route.params.get('category'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cart, setCart] = useState(loadCart)
  const [products, setProducts] = useState<Product[]>([])
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>(supabase ? 'loading' : 'error')
  const [catalogRefresh, setCatalogRefresh] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [orders, setOrders] = useState<{ owner: string; list: Order[]; error: boolean } | null>(null)
  const [orderRefresh, setOrderRefresh] = useState(0)
  const [orderState, setOrderState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [createdOrder, setCreatedOrder] = useState<{ owner: string; id: string } | null>(null)
  const orderRequest = useRef<{ owner: string; cart: string; id: string } | null>(null)
  const orderInFlight = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const focusSearchAfterNavigation = useRef(false)
  const main = useRef<HTMLElement>(null)
  const userId = session?.user.id
  const onHome = route.path === '/'
  const product = route.path.startsWith('/product/')
    ? products.find((item) => item.id === route.path.slice('/product/'.length))
    : undefined

  useEffect(() => {
    function readHash() {
      const next = readRoute()
      setRoute(next)
      setSearch(next.params.get('q') ?? '')
      setQuantity(1)
      setMobileOpen(false)
    }
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (focusSearchAfterNavigation.current && route.path === '/catalog') {
      focusSearchAfterNavigation.current = false
      searchInput.current?.focus({ preventScroll: true })
    } else {
      main.current?.focus({ preventScroll: true })
    }
  }, [route.path])

  useEffect(() => {
    const title = product?.name ?? ({
      '/catalog': 'Catalog', '/cart': 'Your cart', '/account': 'My account',
      '/account/password': 'Change password', '/support': 'Support center',
      '/faq': 'FAQ', '/about': 'About', '/privacy': 'Privacy notice', '/terms': 'Storefront terms',
    } as Record<string, string>)[route.path]
    document.title = title ? `${title} | Gaming Entertainment Ecosystem` : 'Gaming Entertainment Ecosystem'
  }, [route.path, product?.name])

  useEffect(() => {
    if (!supabase) return
    const controller = new AbortController()
    void fetchProducts(supabase).abortSignal(controller.signal).then(({ data, error }) => {
      if (controller.signal.aborted) return
      setProducts(data ?? [])
      setCatalogState(error ? 'error' : 'ready')
    })
    return () => controller.abort()
  }, [catalogRefresh])

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession)
      setAuthReady(true)
      if (event === 'PASSWORD_RECOVERY') navigate('#/account/password')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !userId) return
    const controller = new AbortController()
    void fetchOrders(supabase).abortSignal(controller.signal).then(({ data, error }) => {
      if (!controller.signal.aborted) setOrders({ owner: userId, list: data ?? [], error: Boolean(error) })
    })
    return () => controller.abort()
  }, [userId, orderRefresh])

  useEffect(() => {
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart))
    } catch {
      // The cart still works for the active session when storage is unavailable.
    }
  }, [cart])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (searchInput.current) searchInput.current.focus()
        else {
          focusSearchAfterNavigation.current = true
          navigate('#/catalog')
        }
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const query = search.trim().toLowerCase()
  const filteredProducts = products.filter((product) =>
    (activeCategory === 'All' || product.category === activeCategory) &&
    `${product.name} ${product.type} ${product.category}`.toLowerCase().includes(query)
  )
  if (sort === 'price-low') filteredProducts.sort((left, right) => left.price - right.price)
  if (sort === 'price-high') filteredProducts.sort((left, right) => right.price - left.price)
  if (sort === 'name') filteredProducts.sort((left, right) => left.name.localeCompare(right.name))

  const cartItems = products.flatMap((product) => {
    const quantity = cart[product.id]
    return quantity ? [{ product, quantity }] : []
  })
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0)

  function changeQuantity(id: string, delta: number) {
    if (orderInFlight.current) return
    setOrderState('idle')
    setCart((previous) => {
      const quantity = Math.min(99, (previous[id] ?? 0) + delta)
      const updated = { ...previous }
      if (quantity > 0) updated[id] = quantity
      else delete updated[id]
      return updated
    })
  }

  function addToCart(product: Product, units = 1) {
    changeQuantity(product.id, units)
    navigate('#/cart')
  }

  async function createOrder() {
    if (!supabase || !userId || !cartItems.length || orderInFlight.current) return
    orderInFlight.current = true
    setOrderState('saving')
    const items = cartItems.map(({ product, quantity }) => ({ product_id: product.id, quantity }))
      .sort((left, right) => left.product_id.localeCompare(right.product_id))
    const cartSignature = JSON.stringify(items)
    const requestKey = `${cartStorageKey}.order.${userId}`
    try {
      let request = orderRequest.current?.owner === userId ? orderRequest.current : null
      try {
        request ??= JSON.parse(window.sessionStorage.getItem(requestKey) ?? 'null')
      } catch {
        // A request can still be retried in the current page.
      }
      if (request?.owner !== userId || request.cart !== cartSignature || typeof request.id !== 'string') {
        request = { owner: userId, cart: cartSignature, id: window.crypto.randomUUID() }
      }
      orderRequest.current = request
      try {
        window.sessionStorage.setItem(requestKey, JSON.stringify(request))
      } catch {
        // Keep the request ID in memory if storage is unavailable.
      }
      const { data, error } = await supabase.rpc('create_marketplace_order', { requested_items: items, request_id: request.id })
      if (error || typeof data !== 'string') {
        setOrderState('error')
        return
      }
      setCreatedOrder({ owner: userId, id: data })
      setCart({})
      orderRequest.current = null
      try {
        window.sessionStorage.removeItem(requestKey)
      } catch {
        // The order is already recorded.
      }
      setOrders(null)
      setOrderRefresh((value) => value + 1)
      setOrderState('idle')
      if (readRoute().path === '/cart') navigate('#/account')
    } catch {
      setOrderState('error')
    } finally {
      orderInFlight.current = false
    }
  }

  const catalogNotice = catalogState === 'loading' ? (
    <p className="empty-state" role="status">Loading products…</p>
  ) : catalogState === 'error' ? (
    <div className="empty-state" role="status">
      <p>The catalog is temporarily unavailable.</p>
      {supabase && <AppButton onClick={() => { setCatalogState('loading'); setCatalogRefresh((value) => value + 1) }}>Retry</AppButton>}
    </div>
  ) : null

  const productGrid = (items: Product[]) => (
    <div className="product-grid">
      {items.map((item) => (
        <article className="product-card" key={item.id}>
          <a className="product-art" href={`#/product/${item.id}`} aria-label={`View ${item.name} details`}>
            <ProductArt product={item} />
          </a>
          <div className="product-info">
            <p>{item.category} <span aria-hidden="true">/</span> {item.type}</p>
            <h3><a href={`#/product/${item.id}`}>{item.name}</a></h3>
            <div className="product-action">
              <strong>{formatPrice(item.price)} <small>USD</small></strong>
              <button className="price-button" aria-label={`Add ${item.name} to cart`} onClick={() => addToCart(item)}><Icon name="bag" size={17} /></button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )

  const cartPage = (
    <Page title="Your cart" className="cart-page" intro="Review your items before saving the order.">
      {catalogNotice ?? (
        cartItems.length === 0
          ? <div className="cart-empty"><Icon name="bag" size={36} /><h2>Your cart is empty.</h2><p>Explore game credit, wallet credit and gift cards.</p><a className="button button-primary" href="#/catalog">Browse products <Icon name="arrow" size={17} /></a></div>
          : <div className="page-columns cart-layout">
            <div className="page-card cart-panel">
              <h2>Items <span>{itemCount}</span></h2>
              <ul className="cart-list">
                {cartItems.map(({ product: item, quantity }) => (
                  <li key={item.id}>
                    <div className="cart-item-info">
                      <div className="product-art cart-thumbnail" aria-hidden="true"><ProductArt product={item} /></div>
                      <div><strong><a href={`#/product/${item.id}`}>{item.name}</a></strong><p>{item.type} · {formatPrice(item.price)} each</p></div>
                    </div>
                    <div className="cart-quantity">
                      <AppButton variant="ghost" ariaLabel={`Decrease ${item.name} quantity`} onClick={() => changeQuantity(item.id, -1)} disabled={orderState === 'saving'}>−</AppButton>
                      <span>{quantity}</span>
                      <AppButton variant="ghost" ariaLabel={`Increase ${item.name} quantity`} onClick={() => changeQuantity(item.id, 1)} disabled={quantity === 99 || orderState === 'saving'}>+</AppButton>
                    </div>
                    <div className="cart-line-total">
                      <strong>{formatPrice(item.price * quantity)}</strong>
                      <button type="button" className="cart-remove" aria-label={`Remove ${item.name} from cart`} onClick={() => changeQuantity(item.id, -quantity)} disabled={orderState === 'saving'}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
              <a className="card-link" href="#/catalog">Continue browsing <Icon name="arrow" size={16} /></a>
            </div>
            <div className="page-card order-summary cart-summary">
              <h2>Order summary</h2>
              <p className="cart-subtotal" aria-live="polite"><strong>Estimated subtotal</strong><strong>{formatPrice(subtotal)} USD</strong></p>
              <p className="order-notice"><Icon name="shield" size={19} /><span>Saving an order does not charge you. Online payments and delivery are unavailable.</span></p>
              {orderState === 'error' && <p role="alert">We could not confirm your order. Try again or check your order history.</p>}
              {!authReady ? <p role="status">Checking your sign-in…</p> : session
                ? <AppButton onClick={() => void createOrder()} disabled={orderState === 'saving'}>{orderState === 'saving' ? 'Saving order…' : 'Save order'}</AppButton>
                : <a className="button button-primary" href="#/account?returnTo=cart">Sign in to save your order</a>}
            </div>
          </div>
      )}
    </Page>
  )

  const accountPage = (
    <Page title={session ? 'My account' : 'Sign in'} className="account-page" intro={session ? 'Review your account and order history.' : 'Access your saved orders and support requests.'}>
      <div className="account-layout">
      <div className="page-card account-primary">
        {route.params.get('password') === 'updated' && session && <p role="status">Your password was updated.</p>}
        {!authReady ? <p role="status">Checking your sign-in…</p> : <AccountPanel
          key={userId ?? 'guest'}
          session={session}
          orders={orders?.owner === userId ? orders ?? undefined : undefined}
          createdOrder={createdOrder?.owner === userId ? createdOrder?.id : undefined}
          retry={() => { setOrders(null); setOrderRefresh((value) => value + 1) }}
          onCart={() => navigate('#/cart')}
          hasCart={itemCount > 0}
          returnTo={route.params.get('returnTo') === 'support' ? 'support' : undefined}
        />}
      </div>
      <aside className="account-aside">
        <Icon name="user" size={28} />
        <h2>{session ? 'Account tools' : 'Your player account'}</h2>
        <p>{session ? 'Get help with an order or update how you sign in.' : 'Save your cart as an order and keep the details, prices and status in one place.'}</p>
        <a href="#/support">Support center <Icon name="arrow" size={15} /></a>
        <a href="#/privacy">Privacy notice <Icon name="arrow" size={15} /></a>
      </aside>
      </div>
    </Page>
  )

  let content: ReactNode
  switch (route.path) {
    case '/':
      content = (
        <>
        <section className="hero storefront-hero">
          <div className="hero-grid container">
            <div className="hero-copy">
              <p className="hero-kicker"><Icon name="gamepad" size={17} /> Digital gaming marketplace</p>
              <h1>Your games.<br /><em>One universe.</em></h1>
              <p>Browse game credit and gift cards for the platforms you play. Compare prices in USD and save an order in your account.</p>
              <div className="hero-actions">
                <a className="button button-primary" href="#/catalog">Explore catalog <Icon name="arrow" size={18} /></a>
                <a className="hero-secondary" href={catalogLink('Gift cards')}>Browse gift cards</a>
              </div>
              <form className="hero-search" role="search" onSubmit={(event) => { event.preventDefault(); navigate(catalogLink('All', search)) }}>
                <Icon name="search" size={18} />
                <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search games or gift cards" aria-label="Search marketplace" aria-keyshortcuts="Control+K Meta+K" />
                <button className="button button-ghost" type="submit">Search</button>
              </form>
            </div>
            <img className="hero-photograph" src={import.meta.env.BASE_URL + 'controller-hero.webp'} alt="Lavender game controller beside digital gift cards" width="1200" height="800" fetchPriority="high" />
          </div>
        </section>

        <section className="container home-category-section" aria-labelledby="category-title">
          <div className="section-title"><h2 id="category-title">Browse by category</h2></div>
          <div className="category-strip">
          {categories.slice(0, 2).map((category) => (
            <a className="category-card" key={category.label} href={catalogLink(category.label)}>
              <span className="category-icon"><Icon name={category.icon} size={24} /></span>
              <span><b>{category.label}</b><small>{category.detail}</small></span>
              <Icon name="arrow" size={20} />
            </a>
          ))}
          </div>
        </section>

        <section className="market-section container">
          <div className="section-title"><h2>Featured products</h2><a className="text-link" href="#/catalog">All products<Icon name="arrow" size={17} /></a></div>
          {catalogNotice ?? (products.length ? productGrid(products.slice(0, 4)) : <p>No products are available right now.</p>)}
        </section>
        <section className="container home-help">
          <div><h2>Need help with an order?</h2><p>Find your order reference or send a private request to support.</p></div>
          <div><a className="button button-dark" href="#/support">Support center <Icon name="arrow" size={17} /></a><a className="button button-ghost" href="#/account">My orders</a></div>
        </section>
        </>
      )
      break
    case '/catalog':
      content = (
        <Page title="Product catalog" className="catalog-page" intro="Browse game credits, wallet credit and gift cards. All prices are in USD.">
          <div className="catalog-layout">
            <aside className="catalog-filters" aria-label="Product categories">
              <h2>Categories</h2>
              {(['All', ...categories.map(({ label }) => label)] as const).map((filter) => (
                <a aria-current={activeCategory === filter ? 'true' : undefined} key={filter} href={catalogLink(filter, search)}>
                  <span>{filter === 'All' ? 'All products' : filter}</span>
                  {catalogState === 'ready' && <small>{filter === 'All' ? products.length : products.filter((item) => item.category === filter).length}</small>}
                </a>
              ))}
            </aside>
            <div className="catalog-results">
              <form className="catalog-search" role="search" onSubmit={(event) => { event.preventDefault(); navigate(catalogLink(activeCategory, search)) }}>
                <label className="sr-only" htmlFor="catalog-query">Search products</label>
                <div><Icon name="search" size={18} /><input id="catalog-query" ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Game or product name" /><button type="submit" className="button button-dark">Search</button></div>
              </form>
              <div className="catalog-toolbar">
                <p aria-live="polite">{catalogState === 'ready' ? `${filteredProducts.length} ${filteredProducts.length === 1 ? 'product' : 'products'}` : ''}</p>
                <label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></label>
              </div>
              {catalogNotice ?? (filteredProducts.length ? productGrid(filteredProducts) : (
                <div className="empty-state"><Icon name="search" size={30} /><h2>No products found</h2><p>{query ? 'Try a different search.' : 'There are no products in this category yet.'}</p><AppButton onClick={() => { setSearch(''); navigate('#/catalog') }}>Reset search</AppButton></div>
              ))}
            </div>
          </div>
        </Page>
      )
      break
    case '/cart':
      content = cartPage
      break
    case '/account':
      content = accountPage
      break
    case '/account/password':
      content = <PasswordPage session={session} authReady={authReady} />
      break
    case '/support':
      content = <SupportPage userId={userId} authReady={authReady} orderRef={route.params.get('order') ?? undefined} />
      break
    case '/faq':
      content = <FaqPage />
      break
    case '/about':
      content = <AboutPage />
      break
    case '/privacy':
      content = <PrivacyPage />
      break
    case '/terms':
      content = <TermsPage />
      break
    default:
      if (route.path.startsWith('/product/') && catalogNotice) {
        content = <Page title="Product details">{catalogNotice}</Page>
      } else if (product) {
        const details = getProductDetails(product)
        const remaining = 99 - (cart[product.id] ?? 0)
        const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4)
        content = (
          <section className="container product-page">
            <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="#/catalog">Catalog</a><Icon name="chevron" size={14} /><a href={catalogLink(product.category)}>{product.category}</a><Icon name="chevron" size={14} /><span>{product.name}</span></nav>
            <div className="product-detail-layout">
              <div className="product-art product-feature-art" aria-hidden="true"><ProductArt product={product} /></div>
              <div className="product-buy">
                <p className="product-kind">{product.type}</p>
                <h1>{product.name}</h1>
                <p className="product-description">{details.description}</p>
                <p className="detail-price">{formatPrice(product.price)} <small>USD each</small></p>
                <div className="product-buy-actions">
                  {remaining > 0 && <label>Quantity<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{Array.from({ length: Math.min(remaining, 10) }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>}
                  <AppButton onClick={() => addToCart(product, quantity)} disabled={remaining === 0}><Icon name="bag" size={19} /> {remaining ? 'Add to cart' : 'Cart limit reached'}</AppButton>
                </div>
                <p className="order-notice"><Icon name="shield" size={19} /><span>Orders can be saved today. Online payment and digital delivery are unavailable.</span></p>
                <a className="card-link" href="#/faq">Order and product FAQ <Icon name="arrow" size={15} /></a>
              </div>
              <section className="product-compatibility">
                <h2>Compatibility</h2>
                <dl><div><dt>Platform or game</dt><dd>{details.platform}</dd></div><div><dt>Product type</dt><dd>{product.type}</dd></div><div><dt>Before you order</dt><dd>{details.beforeOrdering}</dd></div></dl>
              </section>
            </div>
            {related.length > 0 && <section className="related-section"><div className="section-title"><h2>More {product.category.toLowerCase()}</h2><a href={catalogLink(product.category)}>View category <Icon name="arrow" size={16} /></a></div>{productGrid(related)}</section>}
          </section>
        )
      } else {
        content = <Page title="Page not found" intro="This page or product is unavailable."><a className="button button-primary" href="#/catalog">Back to the catalog</a></Page>
      }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#site-content" onClick={(event) => { event.preventDefault(); main.current?.focus() }}>Skip to content</a>
      <header className="nav-wrap">
        <nav className="nav container" aria-label="Main navigation">
          <a className="brand" href="#/" aria-label="Gaming Ecosystem home">
            <span className="brand-mark"><Icon name="gamepad" size={22} /></span>
            <span className="brand-wordmark">Gaming <b>Ecosystem</b></span>
          </a>
          <div id="main-menu" className={`nav-links ${mobileOpen ? 'is-open' : ''}`}>
            <a href="#/catalog" onClick={() => setMobileOpen(false)} aria-current={route.path === '/catalog' || route.path.startsWith('/product/') ? 'page' : undefined}>Marketplace</a>
            <a href="#/support" onClick={() => setMobileOpen(false)} aria-current={route.path === '/support' ? 'page' : undefined}>Support</a>
            <a href="#/about" onClick={() => setMobileOpen(false)} aria-current={route.path === '/about' ? 'page' : undefined}>About</a>
          </div>
          <div className="nav-actions">
            <span className="region-button"><Icon name="globe" size={18} /><span>HT / USD</span></span>
            <a className="button button-dark" aria-label={session ? 'My account' : 'Sign in'} href="#/account" aria-current={route.path === '/account' ? 'page' : undefined}><Icon name="user" size={18} /><span>{session ? 'My account' : 'Sign in'}</span></a>
            <a className="button button-icon" aria-label={`Open cart (${itemCount} items)`} href="#/cart" aria-current={route.path === '/cart' ? 'page' : undefined}>
              <Icon name="bag" size={20} />
              {itemCount > 0 && <span className="cart-dot" aria-hidden="true">{itemCount > 99 ? '99+' : itemCount}</span>}
            </a>
            <button type="button" className="button button-icon mobile-menu" aria-label="Toggle menu" aria-expanded={mobileOpen} aria-controls="main-menu" onClick={() => setMobileOpen(!mobileOpen)}><Icon name="menu" /></button>
          </div>
        </nav>
      </header>
      <main id="site-content" tabIndex={-1} className={onHome ? undefined : 'interior-main'} ref={main}>{content}</main>
      <footer>
        <div className="container footer-main">
          <div><a className="brand footer-brand" href="#/"><span className="brand-mark"><Icon name="gamepad" size={22} /></span><span className="brand-wordmark">Gaming <b>Ecosystem</b></span></a><p>Built for players in Haiti and the Caribbean.</p></div>
          <nav className="footer-links" aria-label="Footer navigation">
            <div><b>Shop</b><a href="#/catalog">Marketplace</a><a href={catalogLink('Top-ups')}>Top-ups</a><a href={catalogLink('Gift cards')}>Gift cards</a></div>
            <div><b>Help</b><a href="#/support">Support center</a><a href="#/faq">FAQ</a><a href="#/account">My orders</a></div>
            <div><b>Company</b><a href="#/about">About</a><a href="#/privacy">Privacy notice</a><a href="#/terms">Storefront terms</a></div>
          </nav>
        </div>
        <div className="container footer-bottom"><span>© {new Date().getFullYear()} Gaming Entertainment Ecosystem</span><span>Haiti · USD</span></div>
      </footer>
    </div>
  )
}
