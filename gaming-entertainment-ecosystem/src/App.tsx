import { useMemo, useState, type ReactNode } from 'react'

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
  { name: 'Free Fire', type: 'Diamonds', mark: 'FF', tone: 'orange', price: 'From $1.05', tag: 'Hot' },
  { name: 'PUBG Mobile', type: 'UC', mark: 'P', tone: 'gold', price: 'From $0.99', tag: 'Best seller' },
  { name: 'Call of Duty', type: 'CP', mark: 'COD', tone: 'silver', price: 'From $1.49', tag: '' },
  { name: 'Mobile Legends', type: 'Diamonds', mark: 'ML', tone: 'blue', price: 'From $1.15', tag: '−5%' },
  { name: 'Roblox', type: 'Robux', mark: 'R', tone: 'red', price: 'From $4.99', tag: '' },
  { name: 'Valorant', type: 'Points', mark: 'V', tone: 'coral', price: 'From $5.00', tag: 'New' },
  { name: 'Steam', type: 'Wallet', mark: 'S', tone: 'navy', price: 'From $5.00', tag: '' },
  { name: 'PlayStation', type: 'Gift card', mark: 'PS', tone: 'royal', price: 'From $10.00', tag: '' },
]

const categories = [
  { label: 'Top-ups', detail: 'Instant game credit', icon: 'bolt' as IconName },
  { label: 'Gift cards', detail: 'Global & regional', icon: 'gift' as IconName },
  { label: 'Game codes', detail: 'PC & console', icon: 'gamepad' as IconName },
  { label: 'Subscriptions', detail: 'Play without limits', icon: 'spark' as IconName },
]

function AppButton({ children, variant = 'primary', onClick, ariaLabel }: { children: ReactNode; variant?: 'primary' | 'ghost' | 'icon' | 'dark'; onClick?: () => void; ariaLabel?: string }) {
  return <button className={`button button-${variant}`} onClick={onClick} aria-label={ariaLabel}>{children}</button>
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action && <button className="text-link">{action}<Icon name="arrow" size={17} /></button>}
    </div>
  )
}

export default function App() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => {
      const matchesSearch = !query || `${product.name} ${product.type}`.toLowerCase().includes(query)
      const matchesCategory = activeCategory === 'All' || (activeCategory === 'Top-ups' && product.type !== 'Gift card' && product.type !== 'Wallet') || (activeCategory === 'Gift cards' && (product.type === 'Gift card' || product.type === 'Wallet'))
      return matchesSearch && matchesCategory
    })
  }, [search, activeCategory])

  const announce = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  return (
    <div className="app-shell">
      <div className="announcement">
        <span><Icon name="spark" size={15} /> New player offer: get 10% back on your first top-up</span>
        <button onClick={() => announce('Offer saved to your account')}>Claim offer <Icon name="arrow" size={14} /></button>
      </div>

      <header className="nav-wrap">
        <nav className="nav container" aria-label="Main navigation">
          <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Brand home">
            <span className="brand-mark"><Icon name="gamepad" size={22} /></span>
            <span>[BRAND <b>NAME]</b></span>
          </button>
          <div className={`nav-links ${mobileOpen ? 'is-open' : ''}`}>
            <button className="active">Marketplace</button>
            <button>Discover</button>
            <button>Community</button>
            <button>Compete</button>
          </div>
          <div className="nav-actions">
            <button className="region-button"><Icon name="globe" size={18} /><span>HT / USD</span><Icon name="chevron" size={14} /></button>
            <AppButton variant="icon" ariaLabel="Open cart"><Icon name="bag" size={20} /><span className="cart-dot">2</span></AppButton>
            <AppButton variant="dark"><Icon name="user" size={18} /><span>Sign in</span></AppButton>
            <AppButton variant="icon" ariaLabel="Toggle menu" onClick={() => setMobileOpen(!mobileOpen)}><span className="mobile-menu"><Icon name="menu" /></span></AppButton>
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
              <div className="hero-search">
                <Icon name="search" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search games, gift cards, subscriptions…" aria-label="Search marketplace" />
                <kbd>⌘ K</kbd>
                <AppButton onClick={() => document.getElementById('popular')?.scrollIntoView({ behavior: 'smooth' })}>Search</AppButton>
              </div>
              <div className="hero-trust">
                <span><Icon name="shield" size={18} /> Secure checkout</span>
                <span><Icon name="bolt" size={18} /> Instant delivery</span>
                <span><Icon name="headset" size={18} /> 24/7 support</span>
              </div>
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
            <button className="category-card" key={category.label} onClick={() => setActiveCategory(category.label === 'Top-ups' || category.label === 'Gift cards' ? category.label : 'All')}>
              <span className="category-icon"><Icon name={category.icon} /></span>
              <span><b>{category.label}</b><small>{category.detail}</small></span>
              <Icon name="chevron" size={18} />
            </button>
          ))}
        </section>

        <section className="market-section container" id="popular">
          <SectionTitle eyebrow="Marketplace" title="Popular right now" action="Browse all products" />
          <div className="filter-row" role="tablist" aria-label="Product categories">
            {['All', 'Top-ups', 'Gift cards'].map((filter) => <button role="tab" aria-selected={activeCategory === filter} className={activeCategory === filter ? 'selected' : ''} key={filter} onClick={() => setActiveCategory(filter)}>{filter}</button>)}
          </div>
          {filteredProducts.length ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article className="product-card" key={product.name}>
                  <button className="product-art" onClick={() => announce(`${product.name} selected`)}>
                    <span className={`art-bg tone-${product.tone}`} />
                    <span className="art-noise" />
                    <strong>{product.mark}</strong>
                    {product.tag && <span className="product-tag">{product.tag}</span>}
                  </button>
                  <div className="product-info">
                    <div><h3>{product.name}</h3><p>{product.type}</p></div>
                    <button className="price-button" onClick={() => announce(`${product.name} added to cart`)}><span>{product.price}</span><Icon name="chevron" size={16} /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><Icon name="search" size={30} /><h3>No products found</h3><p>Try another game or browse all products.</p><AppButton onClick={() => { setSearch(''); setActiveCategory('All') }}>Reset search</AppButton></div>
          )}
        </section>

        <section className="value-section">
          <div className="container value-grid">
            <div className="value-copy">
              <p className="eyebrow">More than a marketplace</p>
              <h2>Everything gaming,<br />connected.</h2>
              <p>One identity for how you buy, play, connect, and compete. Your next gaming chapter starts here.</p>
              <AppButton variant="primary" onClick={() => announce('Welcome to the community')}>Explore the ecosystem <Icon name="arrow" size={18} /></AppButton>
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
          <div><div className="brand footer-brand"><span className="brand-mark"><Icon name="gamepad" size={22} /></span><span>[BRAND <b>NAME]</b></span></div><p>The operating system for your gaming life.</p></div>
          <div className="footer-links"><div><b>Explore</b><button>Marketplace</button><button>Discover</button><button>Tournaments</button></div><div><b>Support</b><button>Help center</button><button>Order status</button><button>Contact us</button></div><div><b>Company</b><button>About</button><button>Careers</button><button>Partners</button></div></div>
        </div>
        <div className="container footer-bottom"><span>© 2025 [BRAND NAME]. All rights reserved.</span><span>Built for the Caribbean. Ready for the world.</span></div>
      </footer>
      {notice && <div className="toast" role="status"><Icon name="shield" size={18} />{notice}</div>}
    </div>
  )
}
