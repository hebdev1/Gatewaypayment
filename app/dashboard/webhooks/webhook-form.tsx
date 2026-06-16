"use client";

import { useActionState } from "react";
import { RadioTower } from "lucide-react";
import { createWebhookEndpointAction } from "./actions";

type WebhookState = Awaited<ReturnType<typeof createWebhookEndpointAction>>;

const initialState: WebhookState = {};

export function WebhookEndpointForm() {
  const [state, formAction, pending] = useActionState(
    createWebhookEndpointAction,
    initialState
  );

  return (
    <form action={formAction} className="form-panel stack">
      <h2>Create endpoint</h2>
      <div className="field">
        <label htmlFor="url">URL</label>
        <input className="input" id="url" name="url" type="url" required />
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <input className="input" id="description" name="description" />
      </div>
      <div className="field">
        <label htmlFor="mode">Mode</label>
        <select className="select" id="mode" name="mode" defaultValue="sandbox">
          <option value="sandbox">Sandbox</option>
          <option value="live">Live</option>
        </select>
      </div>
      <button className="button" type="submit" disabled={pending}>
        <RadioTower size={16} aria-hidden="true" />
        {pending ? "Creating" : "Create endpoint"}
      </button>
      {state.secret ? <p className="notice">{state.secret}</p> : null}
      {state.error ? <p className="error">{state.error}</p> : null}
    </form>
  );
}
