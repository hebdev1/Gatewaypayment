# Gaming Entertainment Ecosystem

The React marketplace loads its catalog from Supabase. Customers can sign in, save a cart as an order, and see their order history.

## Run locally

1. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable key. Use only the publishable key in browser builds.
2. Run `pnpm install --frozen-lockfile` and `pnpm dev`.
3. Run `pnpm exec tsc --noEmit` and `pnpm build` before releasing the site.

The migration in `supabase/migrations` defines the catalog, orders, permissions, and starter products for a fresh database. Supabase calculates order totals from the catalog and stores the unit prices at the time an order is placed. The order history is visible only to the signed-in customer who owns it.

## Deploy

GitHub Pages serves the marketplace at `https://hebdev1.github.io/Gatewaypayment/store/` from the `store/` directory on `main`. Build from the repository root with `pnpm exec vite build --base=/Gatewaypayment/store/` and replace the contents of `store/` with the contents of `dist/` in each release commit. For another host or path, adjust the Vite base.

In Supabase Auth, set the Site URL to the public site URL. Add the local development URL to the allowed redirect URLs for testing. Configure production SMTP before opening email registration to customers.

Saved orders start in `awaiting_payment`. The [payment and fulfillment architecture](docs/payments-and-fulfillment.md) defines how to connect providers.
