import { useEffect, useRef, useState, type ReactNode } from 'react'

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

const products = [
  { id: 'free-fire', name: 'Free Fire', type: 'Diamonds', mark: 'FF', tone: 'orange', price: 105, tag: 'Hot' },
  { id: 'pubg-mobile', name: 'PUBG Mobile', type: 'UC', mark: 'P', tone: 'gold', price: 99, tag: 'Best seller' },
  { id: 'call-of-duty', name: 'Call of Duty', type: 'CP', mark: 'COD', tone: 'silver', price: 149, tag: '' },
  { id: 'mobile-legends', name: 'Mobile Legends', type: 'Diamonds', mark: 'ML', tone: 'blue', price: 115, tag: '−5%' },
  { id: 'roblox', name: 'Roblox', type: 'Robux', mark: 'R', tone: 'red', price: 499, tag: '' },
  { id: 'valorant', name: 'Valorant', type: 'Points', mark: 'V', tone: 'coral', price: 500, tag: 'New' },
  { id: 'steam', name: 'Steam', type: 'Wallet', mark: 'S', tone: 'navy', price: 500, tag: '' },
  { id: 'playstation', name: 'PlayStation', type: 'Gift card', mark: 'PS', tone: 'royal', price: 1000, tag: '' },
]

const categories = [
  { label: 'Top-ups', detail: 'Instant game credit', icon: 'bolt' as IconName },
  { label: 'Gift cards', detail: 'Global & regional', icon: 'gift' as IconName },
  { label: 'Game codes', detail: 'PC & console', icon: 'gamepad' as IconName },
  { label: 'Subscriptions', detail: 'Play without limits', icon: 'spark' as IconName },
] as const

type Product = (typeof products)[number]
type Category = 'All' | (typeof categories)[number]['label']
type Cart = Partial<Record<string, number>>

const cartStorageKey = 'gaming-entertainment-ecosystem.cart'
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const formatPrice = (cents: number) => usd.format(cents / 100)
const productCategory = (product: Product) =>
  product.type === 'Gift card' || product.type === 'Wallet' ? 'Gift cards' : 'Top-ups'

function loadCart(): Cart {
  try {
    const saved = JSON.parse(window.localStorage.getItem(cartStorageKey) ?? '{}') as Cart | null
    return Object.fromEntries(products.flatMap(({ id }) => {
      const quantity = saved?.[id]
      return typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 99
        ? [[id, quantity]]
        : []
    }))
  } catch {
    return {}
  }
}

function AppButton({ children, variant = 'primary', onClick, ariaLabel, expanded, disabled }: { children: ReactNode; variant?: 'primary' | 'ghost' | 'icon' | 'dark'; onClick?: () => void; ariaLabel?: string; expanded?: boolean; disabled?: boolean }) {
  return <button type="button" className={`button button-${variant}`} onClick={onClick} aria-label={ariaLabel} aria-expanded={expanded} disabled={disabled}>{children}</button>
}

function SectionTitle({ eyebrow, title, onBrowse }: { eyebrow: string; title: string; onBrowse: () => void }) {
  return (
    <div className="section-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <button className="text-link" onClick={onBrowse}>Browse all products<Icon name="arrow" size={17} /></button>
    </div>
  )
}

export default function App() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cart, setCart] = useState(loadCart)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const marketplace = useRef<HTMLElement>(null)
  const cartDialog = useRef<HTMLDialogElement>(null)
  const productDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart))
    } catch {
      // The cart still works for the active session when storage is unavailable.
    }
  }, [cart])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const query = search.trim().toLowerCase()
  const filteredProducts = products.filter((product) =>
    (activeCategory === 'All' || productCategory(product) === activeCategory) &&
    `${product.name} ${product.type} ${productCategory(product)}`.toLowerCase().includes(query)
  )
  const cartItems = products.flatMap((product) => {
    const quantity = cart[product.id]
    return quantity ? [{ product, quantity }] : []
  })
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0)

  function changeQuantity(id: string, delta: number) {
    setCart((previous) => {
      const quantity = Math.min(99, (previous[id] ?? 0) + delta)
      const updated = { ...previous }
      if (quantity > 0) updated[id] = quantity
      else delete updated[id]
      return updated
    })
  }

  function browse(category: Category = 'All') {
    setSearch('')
    setActiveCategory(category)
    setMobileOpen(false)
    marketplace.current?.scrollIntoView()
  }

  function addToCart(product: Product) {
    changeQuantity(product.id, 1)
    productDialog.current?.close()
    cartDialog.current?.showModal()
  }

  return (
    <div className="app-shell">
      <header className="nav-wrap">
        <nav className="nav container" aria-label="Main navigation">
          <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Brand home">
            <span className="brand-mark"><Icon name="gamepad" size={22} /></span>
            <span>Gaming <b>Ecosystem</b></span>
          </button>
          <div className={`nav-links ${mobileOpen ? 'is-open' : ''}`}>
            <button onClick={() => browse()} className="active">Marketplace</button>
            <button onClick={() => { setMobileOpen(false); document.getElementById('ecosystem')?.scrollIntoView() }}>Discover</button>
          </div>
          <div className="nav-actions">
            <span className="region-button"><Icon name="globe" size={18} /><span>HT / USD</span></span>
            <AppButton variant="icon" ariaLabel={`Open cart (${itemCount} items)`} onClick={() => cartDialog.current?.showModal()}>
              <Icon name="bag" size={20} />
              {itemCount > 0 && <span className="cart-dot" aria-hidden="true">{itemCount > 99 ? '99+' : itemCount}</span>}
            </AppButton>
            <AppButton variant="icon" ariaLabel="Toggle menu" expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><span className="mobile-menu"><Icon name="menu" /></span></AppButton>
          </div>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-grid container">
            <div className="hero-copy">
              <div className="status-pill"><span /> Built for players, everywhere</div>
              <h1>Your games.<br /><em>One universe.</em></h1>
              <p>Top up faster, unlock new worlds, and manage everything you play—all from one trusted platform.</p>
              <form className="hero-search" role="search" onSubmit={(event) => { event.preventDefault(); marketplace.current?.scrollIntoView() }}>
                <Icon name="search" />
                <input ref={searchInput} value={search} onChange={(event) => { setSearch(event.target.value); setActiveCategory('All') }} placeholder="Search games and gift cards…" aria-label="Search marketplace" aria-keyshortcuts="Control+K Meta+K" />
                <kbd>Ctrl / ⌘ K</kbd>
                <button className="button button-primary" type="submit">Search</button>
              </form>
            </div>

            <div className="hero-visual" aria-label="Gaming wallet preview">
              <div className="orb orb-one" />
              <div className="orb orb-two" />
              <div className="game-card card-back">
                <span>GLOBAL PASS</span><b>PLAY+</b><small>365 days of play</small>
              </div>
              <div className="game-card card-front">
                <div className="card-top"><span className="mini-brand"><Icon name="gamepad" size={15} /></span><span>PLAYER WALLET</span></div>
                <div className="balance-label">Available balance</div>
                <strong>$124.80</strong>
                <div className="card-bottom"><span>•••• 8042</span><span>VIRTUAL</span></div>
              </div>
              <div className="floating-chip chip-delivery"><span><Icon name="bolt" size={17} /></span><div><b>Delivered</b><small>+ 1,060 Diamonds</small></div></div>
              <div className="floating-chip chip-level"><span><Icon name="trophy" size={17} /></span><div><b>Level 08</b><small>2,450 XP earned</small></div></div>
            </div>
          </div>
        </section>

        <section className="category-strip container">
          {categories.map((category) => (
            <button className="category-card" key={category.label} onClick={() => browse(category.label)}>
              <span className="category-icon"><Icon name={category.icon} /></span>
              <span><b>{category.label}</b><small>{category.detail}</small></span>
              <Icon name="chevron" size={18} />
            </button>
          ))}
        </section>

        <section className="market-section container" id="popular" ref={marketplace}>
          <SectionTitle eyebrow="Marketplace" title="Popular right now" onBrowse={() => browse()} />
          <div className="filter-row" role="group" aria-label="Product categories">
            {(['All', ...categories.map(({ label }) => label)] as const).map((filter) => (
              <button aria-pressed={activeCategory === filter} className={activeCategory === filter ? 'selected' : ''} key={filter} onClick={() => setActiveCategory(filter)}>{filter}</button>
            ))}
          </div>
          {filteredProducts.length ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <button className="product-art" aria-label={`View ${product.name} details`} onClick={() => { setSelectedProduct(product); productDialog.current?.showModal() }}>
                    <span className={`art-bg tone-${product.tone}`} />
                    <span className="art-noise" />
                    <strong>{product.mark}</strong>
                    {product.tag && <span className="product-tag">{product.tag}</span>}
                  </button>
                  <div className="product-info">
                    <div><h3>{product.name}</h3><p>{product.type}</p></div>
                    <button className="price-button" aria-label={`Add ${product.name} to cart`} onClick={() => addToCart(product)}><span>From {formatPrice(product.price)}</span><Icon name="chevron" size={16} /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><Icon name="search" size={30} /><h3>No products found</h3><p>{query ? 'Try another search or browse all products.' : 'There are no products in this category yet.'}</p><AppButton onClick={() => browse()}>Reset search</AppButton></div>
          )}
        </section>

        <section className="value-section" id="ecosystem">
          <div className="container value-grid">
            <div className="value-copy">
              <p className="eyebrow">More than a marketplace</p>
              <h2>Everything gaming,<br />connected.</h2>
              <p>One identity for how you buy, play, connect, and compete. Your next gaming chapter starts here.</p>
              <AppButton variant="primary" onClick={() => browse()}>Explore the marketplace <Icon name="arrow" size={18} /></AppButton>
            </div>
            <div className="ecosystem-grid">
              <div className="eco-card featured"><span><Icon name="compass" /></span><small>DISCOVER</small><b>Find your<br />next obsession.</b><div className="eco-art"><i /><i /><i /></div></div>
              <div className="eco-card"><span><Icon name="user" /></span><small>COMMUNITY</small><b>Squad up.<br />Stay connected.</b></div>
              <div className="eco-card"><span><Icon name="trophy" /></span><small>COMPETE</small><b>Enter. Play.<br />Take the crown.</b></div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-main">
          <div><div className="brand footer-brand"><span className="brand-mark"><Icon name="gamepad" size={22} /></span><span>Gaming <b>Ecosystem</b></span></div><p>The operating system for your gaming life.</p></div>
          <div className="footer-links"><div><b>Explore</b><button onClick={() => browse()}>Marketplace</button><button onClick={() => browse('Top-ups')}>Top-ups</button><button onClick={() => browse('Gift cards')}>Gift cards</button></div></div>
        </div>
        <div className="container footer-bottom"><span>© {new Date().getFullYear()} Gaming Entertainment Ecosystem</span><span>Built for the Caribbean. Ready for the world.</span></div>
      </footer>

      <dialog className="shop-dialog" aria-labelledby="product-title" ref={productDialog}>
        <div className="shop-dialog-header">
          <h2 id="product-title">{selectedProduct?.name ?? 'Product details'}</h2>
          <AppButton variant="ghost" onClick={() => productDialog.current?.close()}>Close</AppButton>
        </div>
        {selectedProduct && (
          <div className="shop-dialog-body">
            <p>{selectedProduct.type}</p>
            <p>From <strong>{formatPrice(selectedProduct.price)}</strong> USD</p>
            <AppButton onClick={() => addToCart(selectedProduct)} disabled={cart[selectedProduct.id] === 99}>Add to cart</AppButton>
          </div>
        )}
      </dialog>

      <dialog className="shop-dialog" aria-labelledby="cart-title" ref={cartDialog}>
        <div className="shop-dialog-header">
          <h2 id="cart-title">Your cart</h2>
          <AppButton variant="ghost" onClick={() => cartDialog.current?.close()}>Close</AppButton>
        </div>
        {cartItems.length === 0 ? <p className="shop-dialog-body">Your cart is empty.</p> : (
          <div className="shop-dialog-body">
            <ul className="cart-list">
              {cartItems.map(({ product, quantity }) => (
                <li key={product.id}>
                  <div><strong>{product.name}</strong><p>{product.type} · {formatPrice(product.price)} each</p></div>
                  <div className="cart-quantity">
                    <AppButton variant="ghost" ariaLabel={`Decrease ${product.name} quantity`} onClick={() => changeQuantity(product.id, -1)}>−</AppButton>
                    <span aria-label={`${product.name} quantity`}>{quantity}</span>
                    <AppButton variant="ghost" ariaLabel={`Increase ${product.name} quantity`} onClick={() => changeQuantity(product.id, 1)} disabled={quantity === 99}>+</AppButton>
                  </div>
                </li>
              ))}
            </ul>
            <p className="cart-subtotal" aria-live="polite"><strong>Estimated subtotal</strong><strong>{formatPrice(subtotal)} USD</strong></p>
            <p className="cart-status">Checkout is coming soon.</p>
          </div>
        )}
      </dialog>
    </div>
  )
}
