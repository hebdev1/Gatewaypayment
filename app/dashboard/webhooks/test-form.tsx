"use client";

import { useActionState } from "react";
import { sendTestWebhookAction, type TestState } from "./test-actions";

const initial: TestState = {};

const EVENT_TYPES = [
  "payment.succeeded",
  "payment.failed",
  "payment.canceled",
  "payment.expired",
  "refund.pending",
  "refund.succeeded",
  "refund.failed"
] as const;

export function WebhookTestForm({ endpoints }: { endpoints: Array<{ id: string; url: string; mode: string }> }) {
  const [state, formAction, pending] = useActionState(sendTestWebhookAction, initial);

  if (!endpoints.length) {
    return (
      <p className="empty" style={{ padding: 20 }}>
        Create an endpoint first to send a test event.
      </p>
    );
  }

  return (
    <form action={formAction} className="stack" style={{ padding: 16 }}>
      <h3>Send a test event</h3>
      <p className="muted" style={{ marginTop: -8 }}>
        Useful for verifying your endpoint accepts the signature and processes the
        payload. The event is queued in the outbox and dispatched within a minute.
      </p>
      <div className="split-grid">
        <div className="field">
          <label htmlFor="endpoint_id">Endpoint</label>
          <select className="input" id="endpoint_id" name="endpoint_id" required>
            {endpoints.map((e) => (
              <option key={e.id} value={e.id}>
                {e.url} ({e.mode})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="event_type">Event type</label>
          <select className="input" id="event_type" name="event_type" defaultValue="payment.succeeded">
            {EVENT_TYPES.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.queued ? <p className="notice">Queued. Check the deliveries table in ~1 minute.</p> : null}
      <div className="row-actions">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Queueing..." : "Send test event"}
        </button>
      </div>
    </form>
  );
}
