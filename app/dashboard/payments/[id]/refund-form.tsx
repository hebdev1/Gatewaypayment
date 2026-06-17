"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { createRefundAction, type RefundActionState } from "./actions";

const initialState: RefundActionState = {};

export function RefundForm({
  paymentId,
  currency,
  maxAmount
}: {
  paymentId: string;
  currency: string;
  maxAmount: number;
}) {
  const [state, formAction, pending] = useActionState(createRefundAction, initialState);

  return (
    <form action={formAction} className="form-panel stack">
      <input type="hidden" name="payment_id" value={paymentId} />
      <h3>Issue a refund</h3>
      <div className="split-grid">
        <div className="field">
          <label htmlFor="refund-amount">Amount ({currency})</label>
          <input
            className="input"
            id="refund-amount"
            name="amount"
            type="number"
            min="0.01"
            max={maxAmount}
            step="0.01"
            defaultValue={maxAmount}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="refund-reason">Reason (optional)</label>
          <input className="input" id="refund-reason" name="reason" type="text" maxLength={500} />
        </div>
      </div>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.success ? <p className="notice">Refund created.</p> : null}
      <button className="button" type="submit" disabled={pending}>
        <RotateCcw size={14} aria-hidden="true" />
        {pending ? "Processing..." : "Create refund"}
      </button>
    </form>
  );
}
