// Garage — can a workshop use the app right now? Shared by the browser (to show
// the trial banner or the payment screen) and the server (to refuse changes).

import type { Tenant } from "@/types";

export const TRIAL_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export type BillingState =
  | { kind: "exempt" }
  | { kind: "paid"; status: string; periodEnd?: string; cancelAtPeriodEnd: boolean }
  | { kind: "trial"; daysLeft: number; endsAt: string }
  | { kind: "blocked"; reason: "trial_ended" | "payment_failed" | "canceled" };

/** Paid Stripe statuses that keep the app open. */
const PAID = new Set(["active", "trialing"]);

/** End of the free trial; workshops created before billing existed count from their creation. */
export function trialEnd(tenant: Pick<Tenant, "billing" | "createdAt">): string {
  if (tenant.billing?.trialEndsAt) return tenant.billing.trialEndsAt;
  const created = Date.parse(tenant.createdAt);
  return new Date((Number.isNaN(created) ? Date.now() : created) + TRIAL_DAYS * DAY).toISOString();
}

export function billingState(
  tenant: Pick<Tenant, "billing" | "createdAt">,
  now = Date.now(),
): BillingState {
  const b = tenant.billing ?? {};
  if (b.exempt) return { kind: "exempt" };
  if (b.status && PAID.has(b.status)) {
    return {
      kind: "paid",
      status: b.status,
      periodEnd: b.currentPeriodEnd,
      cancelAtPeriodEnd: !!b.cancelAtPeriodEnd,
    };
  }
  if (b.status === "past_due" || b.status === "unpaid")
    return { kind: "blocked", reason: "payment_failed" };
  const endsAt = trialEnd(tenant);
  const left = Date.parse(endsAt) - now;
  if (left > 0) return { kind: "trial", daysLeft: Math.ceil(left / DAY), endsAt };
  return { kind: "blocked", reason: b.status === "canceled" ? "canceled" : "trial_ended" };
}

export function isBlocked(tenant: Pick<Tenant, "billing" | "createdAt">, now = Date.now()) {
  return billingState(tenant, now).kind === "blocked";
}
