import type { ReactNode } from 'react'

export function Page({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <section className="container interior-page">
      <h1>{title}</h1>
      {intro && <p className="page-intro">{intro}</p>}
      {children}
    </section>
  )
}

export function AboutPage() {
  return (
    <Page title="About Gaming Ecosystem" intro="A digital gaming marketplace built with players in Haiti and the Caribbean in mind.">
      <div className="page-copy">
        <h2>Find items for the games you play</h2>
        <p>Explore game credit, wallet credit and gift cards. The catalog shows available listings and prices in US dollars.</p>
        <h2>What you can do today</h2>
        <p>Browse products, build a cart and save an order to your account. Payments and digital delivery are currently unavailable.</p>
        <a className="button button-primary" href="#/catalog">Explore the catalog</a>
      </div>
    </Page>
  )
}

export function FaqPage() {
  return (
    <Page title="Frequently asked questions" intro="Find answers about accounts, products and saved orders.">
      <div className="page-copy faq-list">
        <details><summary>How do I save an order?</summary><p>Add products to your cart, sign in and select <strong>Save order</strong>. Your order will appear in <a href="#/account">My account</a>.</p></details>
        <details><summary>Can I pay for or receive a product today?</summary><p>Payments and digital delivery are unavailable. Saving an order keeps a record in your account and does not charge you.</p></details>
        <details><summary>What currency are prices shown in?</summary><p>All catalog prices and order totals use US dollars (USD).</p></details>
        <details><summary>How do I reset my password?</summary><p>Open <a href="#/account">My account</a>, select <strong>Forgot password?</strong> and follow the instructions in the email if it arrives. If you cannot access your account, check your junk mail and confirm that you entered the correct address.</p></details>
        <details><summary>Can I use an item in any region?</summary><p>Game credits and gift cards may have platform or regional restrictions. Confirm compatibility with the publisher before purchasing when payment becomes available.</p></details>
        <p>Need more help? <a href="#/support">Open the support center</a>.</p>
      </div>
    </Page>
  )
}

export function PrivacyPage() {
  return (
    <Page title="Privacy notice" intro="How the storefront uses account, order and support information.">
      <div className="page-copy">
        <h2>Information used by the storefront</h2>
        <p>Supabase handles your email, password authentication and session. Saved orders store your account ID, selected items, quantities, prices and order status. Support stores the subject and message you submit, along with your account ID.</p>
        <h2>Browser storage and service providers</h2>
        <p>Your browser keeps the cart and sign-in session. Temporary browser storage helps prevent duplicate orders on retry. GitHub Pages hosts the storefront, Supabase provides data and authentication, and Google Fonts serves the typefaces.</p>
        <h2>Payment information</h2>
        <p>Online payment is unavailable. The storefront does not ask for card or mobile-wallet details. Keep passwords, payment details and gift codes out of support requests.</p>
        <h2>Privacy questions</h2>
        <p>Use the <a href="#/support">support center</a> from the relevant account to request help with your information. You can sign out from <a href="#/account">My account</a> and clear the cart from your browser's site settings.</p>
      </div>
    </Page>
  )
}

export function TermsPage() {
  return (
    <Page title="Storefront terms" intro="Conditions for using the storefront and saving orders.">
      <div className="page-copy">
        <h2>Accounts and acceptable use</h2>
        <p>Use an email address you control and protect your sign-in details. Use the storefront and support center for legitimate browsing, orders and help requests.</p>
        <h2>Catalog and orders</h2>
        <p>Prices are displayed in USD. The catalog can change. An order is a record of the items and prices shown when it was saved. Payments, automatic delivery and refunds through the storefront are currently unavailable.</p>
        <h2>Publisher compatibility</h2>
        <p>Game and platform names identify the listed products. The applicable publisher sets its own platform, account and region rules.</p>
        <h2>Questions about an order</h2>
        <p>Review your order in <a href="#/account">My account</a>. If something looks wrong, send its reference through the <a href="#/support">support center</a>.</p>
      </div>
    </Page>
  )
}
