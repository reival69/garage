// Garage — subscription actions for the workshop owner (pay, change plan, manage card).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Result =
  { ok: true; url: string | null; error: null } | { ok: false; url: null; error: string };

/** The workshop owner (or the superadmin in support mode) of the current session. */
async function ownerContext() {
  const { currentSession } = await import("@/lib/server/auth.server");
  const { getTenant } = await import("@/lib/server/stripe.server");
  const session = await currentSession();
  if (!session) throw new Error("Inicia sesión.");
  const { user } = session;
  if (user.role !== "owner" || !user.tenantId) {
    throw new Error("Solo el responsable del taller puede gestionar la suscripción.");
  }
  const tenant = await getTenant(user.tenantId);
  if (!tenant) throw new Error("Taller no encontrado.");
  return { user, tenant };
}

async function run(fn: () => Promise<string | null>): Promise<Result> {
  try {
    return { ok: true, url: await fn(), error: null };
  } catch (err) {
    return { ok: false, url: null, error: (err as Error).message || "No se pudo completar." };
  }
}

/** Opens Stripe's payment page for the chosen plan. */
export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator(z.object({ planId: z.string().min(1).max(100) }))
  .handler(async ({ data }) =>
    run(async () => {
      const { createCheckout, getPlan } = await import("@/lib/server/stripe.server");
      const { user, tenant } = await ownerContext();
      const plan = await getPlan(data.planId);
      if (!plan) throw new Error("Plan no encontrado.");
      if (
        tenant.billing?.stripeSubscriptionId &&
        ["active", "trialing", "past_due"].includes(tenant.billing.status ?? "")
      ) {
        throw new Error("Ya tienes una suscripción. Usa «Cambiar de plan» o «Gestionar pago».");
      }
      return createCheckout(tenant, plan, tenant.email || user.email);
    }),
  );

/** Stripe's page to update the card, download invoices or cancel. */
export const openBillingPortal = createServerFn({ method: "POST" }).handler(async () =>
  run(async () => {
    const { createPortal } = await import("@/lib/server/stripe.server");
    const { tenant } = await ownerContext();
    return createPortal(tenant);
  }),
);

/** Switches an existing subscription to another plan. */
export const changePlan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ planId: z.string().min(1).max(100) }))
  .handler(async ({ data }) =>
    run(async () => {
      const { changeSubscriptionPlan, getPlan } = await import("@/lib/server/stripe.server");
      const { tenant } = await ownerContext();
      const plan = await getPlan(data.planId);
      if (!plan) throw new Error("Plan no encontrado.");
      await changeSubscriptionPlan(tenant, plan);
      return null;
    }),
  );

/** Whether online payments are set up on this server. */
export const paymentsEnabled = createServerFn({ method: "GET" }).handler(async () => {
  const { stripeConfigured } = await import("@/lib/server/stripe.server");
  return { enabled: stripeConfigured() };
});
