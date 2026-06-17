"use client";

import { useActionState } from "react";
import { RadioTower } from "lucide-react";
import {
  rotateInboundWebhookTokenAction,
  type ProviderActionState
} from "./actions";

const initialState: ProviderActionState = {};

export function InboundWebhookCard({
  accountId,
  tokenPrefix,
  rotatedAt,
  mode
}: {
  accountId: string;
  tokenPrefix: string | null;
  rotatedAt: string | null;
  mode: "sandbox" | "live";
}) {
  const [state, formAction, pending] = useActionState(
    rotateInboundWebhookTokenAction,
    initialState
  );

  const isOurAccount = !state.account_id || state.account_id === accountId;

  return (
    <section className="form-panel stack">
      <h3>
        <RadioTower size={14} aria-hidden="true" /> {mode === "live" ? "Live" : "Sandbox"} inbound
        webhook
      </h3>
      <p className="muted">
        Configure this URL as the callback in your provider account. The token is shown
        only once when generated; rotate it if you ever leak it.
      </p>

      {tokenPrefix ? (
        <p>
          Current token prefix: <code className="mono">{tokenPrefix}…</code> (rotated{" "}
          {rotatedAt ? new Date(rotatedAt).toLocaleString() : "never"})
        </p>
      ) : (
        <p className="notice">No token configured. The endpoint is currently public.</p>
      )}

      {isOurAccount && state.success && state.inbound_url ? (
        <div className="notice">
          <strong>New inbound URL (copy now — shown only once):</strong>
          <pre className="mono small">{state.inbound_url}</pre>
        </div>
      ) : null}

      {state.error ? <p className="error">{state.error}</p> : null}

      <form action={formAction}>
        <input type="hidden" name="account_id" value={accountId} />
        <button className="button secondary" type="submit" disabled={pending}>
          {pending ? "Rotating..." : tokenPrefix ? "Rotate token" : "Generate token"}
        </button>
      </form>
    </section>
  );
}
