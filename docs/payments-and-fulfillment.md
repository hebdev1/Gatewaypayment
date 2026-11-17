# Payment and digital fulfillment architecture

The browser reads the Supabase catalog and saves orders through `create_marketplace_order`. PostgreSQL calculates the USD total and snapshots the line items. Orders start in `awaiting_payment`. The following services can be added when payment and fulfillment providers are selected.

## Service boundaries

| Component | Contract | Responsibility |
| --- | --- | --- |
| Checkout Edge Function | `POST /checkout` with an order ID | Authenticate the customer, check order ownership and state, then return a hosted checkout URL from the payment provider. |
| Payment provider adapter | `createCheckout(order, idempotencyKey)` and `verifyWebhook(rawBody, headers)` | Translate the gateway API, verify the webhook, and normalize the amount, currency, payment reference, and status. |
| Payment webhook Edge Function | `POST /payment-webhook` | Verify authenticity, record the event once, validate the order reference, amount and currency, then mark the order paid and enqueue fulfillment in the same database transaction. |
| Fulfillment worker | Claim and process pending fulfillment jobs | Send the order line to the supplier, reconcile its delivery status, and update the order only after all lines are confirmed delivered. |
| Supplier adapter | `fulfill(line, idempotencyKey)` and `getStatus(supplierReference)` | Translate internal products to provider SKUs and confirm delivery or return a retryable or permanent failure. |

## Data changes when a provider is selected

- Add private `payment_attempts` records with the internal order ID, provider reference, expected amount and currency, and a unique idempotency key.
- Add private `payment_events` records with a unique provider and event ID. Store the event fields needed for reconciliation and restrict read access to server operations.
- Add private `fulfillment_jobs` records with one job per order line, a supplier reference, retry state, and the next attempt time. Use the job ID as the supplier idempotency key.
- Map each active product to a supplier SKU. Collect a game account identifier only for products whose supplier requires one. Keep gift codes and fulfillment credentials in server-only storage. Deliver gift codes through an authenticated retrieval flow.

## Order lifecycle

1. The customer saves an order, then asks the checkout function for a hosted payment URL. The server reads the total from PostgreSQL.
2. The provider sends a signed webhook. The server checks the signature, event ID, reference, amount, and currency before moving the order from `awaiting_payment` to `paid`. A browser redirect cannot confirm payment.
3. The same transaction queues fulfillment. The worker retries transient failures with bounded backoff and reconciles uncertain provider responses before sending again. Permanent errors go to a manual review queue.
4. The order moves from `paid` to `fulfilled` after the supplier confirms every line. Customers read their status through the existing order policies.

Before launch, test duplicate and out-of-order events, amount mismatches, timeouts after a provider accepts a request, partial fulfillment, and manual reconciliation in the providers' test environments.
