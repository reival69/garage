// Garage — subscriptions with Stripe (server only).
//
// Uses Stripe's REST API directly (no SDK). Needs, in /etc/garage.env:
//   STRIPE_SECRET_KEY      sk_live_… (or sk_test_… to try it out)
//   STRIPE_WEBHOOK_SECRET  whsec_… (from the webhook pointing to /api/stripe/webhook)
//   APP_URL                https://talleo.es
//
// Plan prices come from the plans in the database (IVA included), so changing a
// plan's price in the superadmin panel applies to new subscriptions.
import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { trialEnd } from "@/lib/billing";
import type { Plan, Tenant, TenantBilling } from "@/types";
import { db, GLOBAL_TENANT } from "./db.server";

export class StripeError extends Error {}

export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function appUrl() {
  return (process.env.APP_URL || "https://talleo.es").replace(/\/+$/, "");
}

/** Encodes nested params the way Stripe expects: a[b][0][c]=value. */
function encode(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) =>
        typeof v === "object"
          ? encode(v as Record<string, unknown>, `${name}[${i}]`, out)
          : out.append(`${name}[${i}]`, String(v)),
      );
    } else if (typeof value === "object") {
      encode(value as Record<string, unknown>, name, out);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

async function stripe<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Los pagos todavía no están configurados.");
  const body = encode(params);
  // STRIPE_API_BASE only exists for automated tests against a fake Stripe
  const base = process.env.STRIPE_API_BASE || "https://api.stripe.com";
  const url = `${base}/v1/${path}${method === "GET" && body.size ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": "2024-06-20",
    },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error("Stripe", path, json.error);
    throw new StripeError(json.error?.message || "Stripe no respondió correctamente.");
  }
  return json;
}

// ---- Data helpers ----------------------------------------------------------

async function getDoc<T>(collection: string, id: string): Promise<T | null> {
  const sql = await db();
  const rows = await sql<{ data: T }[]>`
    select data from docs where tenant_id = ${GLOBAL_TENANT} and collection = ${collection} and id = ${id}`;
  return rows[0]?.data ?? null;
}

export const getTenant = (id: string) => getDoc<Tenant>("tenants", id);
export const getPlan = (id: string) => getDoc<Plan>("plans", id);

/** Merges `patch` into the tenant's billing (and optionally sets its plan). */
async function updateBilling(tenantId: string, patch: TenantBilling, planId?: string) {
  const sql = await db();
  const tenant = await getTenant(tenantId);
  if (!tenant) return;
  const next: Tenant = { ...tenant, billing: { ...tenant.billing, ...patch } };
  if (planId) next.planId = planId;
  await sql`
    update docs set data = ${sql.json(next as never)}, updated_at = now()
    where tenant_id = ${GLOBAL_TENANT} and collection = 'tenants' and id = ${tenantId}`;
}

async function tenantByCustomer(customerId: string): Promise<string | null> {
  const sql = await db();
  const rows = await sql<{ id: string }[]>`
    select id from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'tenants'
      and data->'billing'->>'stripeCustomerId' = ${customerId} limit 1`;
  return rows[0]?.id ?? null;
}

/** The Stripe customer for a workshop, created the first time. */
async function ensureCustomer(tenant: Tenant, email: string): Promise<string> {
  if (tenant.billing?.stripeCustomerId) return tenant.billing.stripeCustomerId;
  const customer = await stripe<{ id: string }>("POST", "customers", {
    email,
    name: tenant.legalName || tenant.name,
    metadata: { tenantId: tenant.id },
    preferred_locales: ["es"],
  });
  await updateBilling(tenant.id, { stripeCustomerId: customer.id });
  return customer.id;
}

function priceData(plan: Plan) {
  return {
    currency: "eur",
    unit_amount: Math.round(plan.priceMonthly * 100),
    recurring: { interval: "month" },
    product_data: { name: `Garage ${plan.name}` },
    tax_behavior: "inclusive",
  };
}

// ---- Actions ---------------------------------------------------------------

/** Card payment page for a new subscription. Unused trial days are kept. */
export async function createCheckout(tenant: Tenant, plan: Plan, email: string): Promise<string> {
  const customer = await ensureCustomer(tenant, email);
  const trialEndsAt = Date.parse(trialEnd(tenant));
  // Stripe needs a trial end at least 48 hours away; shorter remainders are dropped
  const keepTrial = trialEndsAt - Date.now() > 49 * 60 * 60 * 1000;
  const session = await stripe<{ url: string }>("POST", "checkout/sessions", {
    mode: "subscription",
    customer,
    locale: "es",
    line_items: [{ price_data: priceData(plan), quantity: 1 }],
    subscription_data: {
      metadata: { tenantId: tenant.id, planId: plan.id },
      trial_end: keepTrial ? Math.floor(trialEndsAt / 1000) : undefined,
    },
    metadata: { tenantId: tenant.id, planId: plan.id },
    client_reference_id: tenant.id,
    success_url: `${appUrl()}/app/suscripcion?pago=ok`,
    cancel_url: `${appUrl()}/app/suscripcion`,
  });
  return session.url;
}

/** Stripe's own page to change the card, see invoices or cancel. */
export async function createPortal(tenant: Tenant): Promise<string> {
  const customer = tenant.billing?.stripeCustomerId;
  if (!customer) throw new StripeError("Este taller todavía no tiene suscripción.");
  const session = await stripe<{ url: string }>("POST", "billing_portal/sessions", {
    customer,
    locale: "es",
    return_url: `${appUrl()}/app/suscripcion`,
  });
  return session.url;
}

interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  current_period_end?: number;
  metadata: Record<string, string>;
  items: { data: { id: string; current_period_end?: number }[] };
}

/** Always re-read the subscription with our pinned API version (webhook payloads follow the account's). */
const fetchSubscription = (id: string) => stripe<StripeSubscription>("GET", `subscriptions/${id}`);

/** Moves an existing subscription to another plan (prorated by Stripe). */
export async function changeSubscriptionPlan(tenant: Tenant, plan: Plan) {
  const subId = tenant.billing?.stripeSubscriptionId;
  if (!subId) throw new StripeError("Este taller todavía no tiene suscripción.");
  const sub = await fetchSubscription(subId);
  const updated = await stripe<StripeSubscription>("POST", `subscriptions/${subId}`, {
    items: [
      {
        id: sub.items.data[0]?.id,
        price_data: {
          ...priceData(plan),
          product_data: undefined,
          product: await productFor(plan),
        },
      },
    ],
    metadata: { tenantId: tenant.id, planId: plan.id },
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
  });
  await applySubscription(updated);
}

/** Subscription items need a product id (inline product_data only works in Checkout). */
async function productFor(plan: Plan): Promise<string> {
  const found = await stripe<{ data: { id: string }[] }>("GET", "products/search", {
    query: `metadata['planId']:'${plan.id}' AND active:'true'`,
  });
  if (found.data[0]) return found.data[0].id;
  const product = await stripe<{ id: string }>("POST", "products", {
    name: `Garage ${plan.name}`,
    metadata: { planId: plan.id },
  });
  return product.id;
}

// ---- Webhooks --------------------------------------------------------------

async function applySubscription(sub: StripeSubscription) {
  const tenantId = sub.metadata?.tenantId || (await tenantByCustomer(sub.customer));
  if (!tenantId) {
    console.warn("Stripe: subscription without workshop", sub.id);
    return;
  }
  const planId = sub.metadata?.planId;
  const periodEnd = sub.current_period_end ?? sub.items?.data[0]?.current_period_end;
  const plan = planId ? await getPlan(planId) : null;
  await updateBilling(
    tenantId,
    {
      status: sub.status,
      stripeCustomerId: sub.customer,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    },
    plan ? plan.id : undefined,
  );
}

/** Checks Stripe's signature (Stripe-Signature: t=…,v1=…), allowing 5 minutes of clock skew. */
export function verifyWebhook(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const sig = Buffer.from(p.slice(3), "hex");
      const exp = Buffer.from(expected, "hex");
      return sig.length === exp.length && timingSafeEqual(sig, exp);
    });
}

/** POST /api/stripe/webhook */
export async function handleWebhook(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const payload = await request.text();
  if (!verifyWebhook(payload, request.headers.get("stripe-signature"), secret)) {
    return new Response("Bad signature", { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;
  try {
    let subscriptionId: unknown = null;
    switch (event.type) {
      case "checkout.session.completed":
      case "invoice.payment_failed":
      case "invoice.paid":
        subscriptionId =
          obj.subscription ??
          (obj.parent as { subscription_details?: { subscription?: string } } | undefined)
            ?.subscription_details?.subscription;
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        subscriptionId = obj.id;
        break;
    }
    if (typeof subscriptionId === "string")
      await applySubscription(await fetchSubscription(subscriptionId));
  } catch (err) {
    console.error("Stripe webhook", event.type, err);
    // Stripe retries on errors, so a temporary failure fixes itself
    return new Response("Error", { status: 500 });
  }
  return new Response("ok");
}
