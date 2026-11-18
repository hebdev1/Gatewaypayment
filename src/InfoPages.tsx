import { useState, type ReactNode } from 'react'

export function Page({ title, intro, children, className = '' }: { title: string; intro?: string; children?: ReactNode; className?: string }) {
  return (
    <section className={`container interior-page ${className}`}>
      <h1>{title}</h1>
      {intro && <p className="page-intro">{intro}</p>}
      {children}
    </section>
  )
}

export function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="container about-heading">
          <div>
            <h1>About Gaming Ecosystem</h1>
            <p>A gaming marketplace for players in Haiti and across the Caribbean.</p>
            <a className="button button-primary" href="#/catalog">Explore the catalog</a>
          </div>
          <div className="about-note">
            <strong>Made for the way you play.</strong>
            <p>Find the right game, check the platform and account region, and compare prices in USD in one place.</p>
          </div>
        </div>
      </section>
      <section className="container about-body">
        <h2>How the storefront works</h2>
        <div className="about-steps">
          <article><h3>Choose a product</h3><p>Browse in-game currencies and gift cards, then check the compatibility notes on the product page.</p><a href="#/catalog">Browse products</a></article>
          <article><h3>Save your order</h3><p>Sign in to save the items in your cart. Your order retains the prices shown when you saved it.</p><a href="#/account">Open your account</a></article>
          <article><h3>Get help if you need it</h3><p>Send a private request with your order reference and track its status from your account.</p><a href="#/support">Visit the support center</a></article>
        </div>
        <div className="policy-callout"><strong>Current availability</strong><p>Browsing and saving orders are available. Online payments and digital delivery are still in development.</p></div>
      </section>
    </div>
  )
}

const faqGroups = [
  { title: 'Orders', questions: [
    ['How do I save an order?', 'Add products to your cart, sign in and choose Save order. Your order and its reference will appear in My account.'],
    ['Can I pay for or receive a product today?', 'Online payments and digital delivery are unavailable. Saving an order records your items and does not charge you.'],
    ['What does Awaiting payment mean?', 'Your order has been saved. No payment has been collected and no item has been delivered.'],
    ['Where do I find my order reference?', 'Open My account and find the order in Recent orders. Use its reference when contacting support.'],
  ] },
  { title: 'Products and prices', questions: [
    ['Can I use an item in any region?', 'Game credits and gift cards may have platform or regional restrictions. See the Compatibility section on the product page and confirm the rules with the publisher.'],
    ['What currency are prices shown in?', 'Catalog prices and order totals are in US dollars (USD).'],
  ] },
  { title: 'Accounts and support', questions: [
    ['How do I reset my password?', 'Open My account, choose Forgot password? and enter your account email. If you receive a reset message, open the link to choose a new password.'],
    ['What should I include in a support request?', 'Describe the issue and add the order reference when relevant. Leave out passwords, gift codes and payment details.'],
  ] },
]

export function FaqPage() {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const groups = faqGroups.map((group) => ({
    ...group,
    questions: group.questions.filter((question) => question.join(' ').toLowerCase().includes(query)),
  })).filter((group) => group.questions.length)

  return (
    <Page title="Frequently asked questions" className="faq-page" intro="Search for answers about products, saved orders and your account.">
      <div className="help-layout">
        <div>
          <label className="faq-search">Search answers<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try password or order reference" /></label>
          {groups.length ? groups.map((group) => (
            <section key={group.title} className="faq-group">
              <h2>{group.title}</h2>
              {group.questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
            </section>
          )) : <p className="empty-state" role="status">No answers match your search.</p>}
        </div>
        <aside className="help-aside">
          <h2>Need a hand?</h2>
          <p>Use the support center to send a private request about your account or order.</p>
          <a className="button button-dark" href="#/support">Open support center</a>
        </aside>
      </div>
    </Page>
  )
}

type Section = { id: string; title: string; content: ReactNode }

function PolicyPage({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return (
    <Page title={title} intro={intro} className="policy-page">
      <div className="policy-layout">
        <nav aria-label="On this page">
          <h2>On this page</h2>
          {sections.map((section) => (
            <button key={section.id} type="button" onClick={() => document.getElementById(section.id)?.focus()}>{section.title}</button>
          ))}
        </nav>
        <div className="policy-article">
          {sections.map((section) => (
            <section key={section.id} id={section.id} tabIndex={-1}>
              <h2>{section.title}</h2>{section.content}
            </section>
          ))}
        </div>
      </div>
    </Page>
  )
}

export function PrivacyPage() {
  return <PolicyPage title="Privacy notice" intro="How Gaming Ecosystem uses your account, order and support information." sections={[
    { id: 'account-data', title: 'Account and order information', content: <p>Supabase handles your email and password authentication. When you save an order, the storefront records your account ID, items, quantities, prices and order status so you can view them in your account.</p> },
    { id: 'support-data', title: 'Support requests', content: <p>The subject and message you send are linked to your account. Store operators can review them to handle your request. Keep passwords, gift codes and payment details out of support messages.</p> },
    { id: 'browser-data', title: 'Browser storage and providers', content: <><p>Your browser stores your cart and sign-in session. Temporary browser storage helps avoid duplicate orders when you retry. You can sign out from My account and clear local storefront data from your browser's site settings.</p><p>GitHub Pages hosts the storefront, Supabase provides data and authentication, and Google Fonts serves the typefaces.</p></> },
    { id: 'payment-data', title: 'Payment information', content: <p>The storefront does not collect card or mobile-wallet details. Online payment is currently unavailable.</p> },
    { id: 'privacy-requests', title: 'Questions about your information', content: <p>Send a request through the <a href="#/support">support center</a> from the account it concerns.</p> },
  ]} />
}

export function TermsPage() {
  return <PolicyPage title="Storefront terms" intro="Conditions for using the marketplace and saving orders." sections={[
    { id: 'use', title: 'Accounts and acceptable use', content: <p>Use an email address you control and keep your sign-in details private. Use the catalog, order and support features for their intended purposes.</p> },
    { id: 'orders', title: 'Listings and saved orders', content: <p>Prices are displayed in USD and may change. A saved order records the items and prices in effect when you saved it. It does not complete a payment.</p> },
    { id: 'compatibility', title: 'Platform and region rules', content: <p>Game and platform names identify the listed products. Publishers set their own rules for supported accounts, platforms and regions. Check the listing and publisher requirements before purchasing when payments become available.</p> },
    { id: 'availability', title: 'Payments, delivery and refunds', content: <p>Payments and digital delivery are currently unavailable. The storefront does not process refunds because it does not collect payments.</p> },
    { id: 'order-support', title: 'Questions about an order', content: <p>Find your order reference in <a href="#/account">My account</a> and include it when contacting the <a href="#/support">support center</a>.</p> },
  ]} />
}
