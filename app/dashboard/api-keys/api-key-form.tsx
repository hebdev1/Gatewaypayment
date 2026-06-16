"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { createApiKeyAction } from "./actions";

type ApiKeyState = Awaited<ReturnType<typeof createApiKeyAction>>;

const initialState: ApiKeyState = {};

export function ApiKeyForm() {
  const [state, formAction, pending] = useActionState(createApiKeyAction, initialState);

  return (
    <form action={formAction} className="form-panel stack">
      <h2>Create API key</h2>
      <div className="field">
        <label htmlFor="name">Name</label>
        <input className="input" id="name" name="name" placeholder="Checkout server" required />
      </div>
      <div className="field">
        <label htmlFor="mode">Mode</label>
        <select className="select" id="mode" name="mode" defaultValue="sandbox">
          <option value="sandbox">Sandbox</option>
          <option value="live">Live</option>
        </select>
      </div>
      <button className="button" type="submit" disabled={pending}>
        <KeyRound size={16} aria-hidden="true" />
        {pending ? "Creating" : "Create key"}
      </button>
      {state.apiKey ? <p className="notice">{state.apiKey}</p> : null}
      {state.error ? <p className="error">{state.error}</p> : null}
    </form>
  );
}
