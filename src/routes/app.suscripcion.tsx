// Garage — Suscripción. The workshop's plan, free trial and card payments
// (Stripe). Only the owner can pay or change the plan; other roles just see the
// state. When the subscription is not active, this is the only screen open.

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/base/PageHeader";
import { Button } from "@/components/ui/button";
import {
  changePlan,
  openBillingPortal,
  paymentsEnabled,
  startCheckout,
} from "@/lib/api/billing.functions";
import { useAuth } from "@/lib/auth/AuthContext";
import { billingState } from "@/lib/billing";
import { plansRepo } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types";

export const Route = createFileRoute("/app/suscripcion")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user, tenant, reload } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    paymentsEnabled()
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, []);

  // Back from Stripe: the confirmation arrives a few seconds later
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.search.includes("pago=ok")) return;
    window.history.replaceState(null, "", window.location.pathname);
    setWaiting(true);
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      void reload();
      if (tries >= 10) {
        clearInterval(timer);
        setWaiting(false);
      }
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state = tenant ? billingState(tenant) : null;
  useEffect(() => {
    if (waiting && state?.kind === "paid") {
      setWaiting(false);
      toast.success("¡Pago recibido! La suscripción está activa.");
    }
  }, [waiting, state?.kind]);

  if (!tenant || !user || !state) return null;
  const isOwner = user.role === "owner";
  const plans = plansRepo.list().sort((a, b) => a.priceMonthly - b.priceMonthly);
  const current = plans.find((p) => p.id === tenant.planId);
  const hasSubscription =
    state.kind === "paid" || (state.kind === "blocked" && state.reason === "payment_failed");

  const go = async (
    key: string,
    action: () => Promise<{ ok: boolean; url: string | null; error: string | null }>,
  ) => {
    setBusy(key);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo completar.");
      } else if (result.url) {
        window.location.href = result.url;
        return;
      } else {
        toast.success("Plan cambiado.");
        await reload();
      }
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    }
    setBusy(null);
  };

  const choosePlan = (plan: Plan) =>
    go(plan.id, () =>
      hasSubscription && state.kind === "paid"
        ? changePlan({ data: { planId: plan.id } })
        : startCheckout({ data: { planId: plan.id } }),
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Suscripción" description="Tu plan de Garage y el pago con tarjeta." />

      <section className="rounded-lg border border-border bg-card p-6">
        <StatusSummary state={state} planName={current?.name} waiting={waiting} />
        {isOwner && tenant.billing?.stripeCustomerId && (
          <Button
            variant="outline"
            className="mt-4"
            disabled={busy !== null}
            onClick={() => void go("portal", () => openBillingPortal())}
          >
            <CreditCard strokeWidth={1.5} />
            {busy === "portal" ? "Abriendo…" : "Gestionar pago, facturas y cancelación"}
            <ExternalLink strokeWidth={1.5} className="h-3.5 w-3.5" />
          </Button>
        )}
      </section>

      {state.kind !== "exempt" && (
        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">
            {state.kind === "paid" ? "Cambiar de plan" : "Elige tu plan"}
          </h2>
          {!isOwner && (
            <p className="text-sm text-muted-foreground">
              Solo el responsable del taller puede elegir el plan y pagar.
            </p>
          )}
          {isOwner && enabled === false && (
            <p className="text-sm text-[var(--destructive)]">
              El pago con tarjeta todavía no está disponible. Contacta con Garage.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === tenant.planId && state.kind === "paid";
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "flex flex-col rounded-lg border bg-card p-5",
                    plan.id === tenant.planId ? "border-foreground" : "border-border",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{plan.name}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {formatCurrency(plan.priceMonthly, "EUR")}
                    <span className="text-sm font-normal text-muted-foreground"> /mes</span>
                  </p>
                  <p className="text-xs text-muted-foreground">IVA incluido</p>
                  <ul className="mt-3 flex-1 space-y-1 text-sm text-muted-foreground">
                    <li>Hasta {plan.limits.maxUsers} usuarios</li>
                    <li>Hasta {plan.limits.maxOrders} órdenes</li>
                    <li>Hasta {plan.limits.maxPhotosPerOrder} fotos por orden</li>
                  </ul>
                  {isOwner && (
                    <Button
                      className="mt-4"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || busy !== null || !enabled}
                      onClick={() => void choosePlan(plan)}
                    >
                      {isCurrent ? (
                        <>
                          <Check strokeWidth={1.5} /> Tu plan
                        </>
                      ) : busy === plan.id ? (
                        "Abriendo…"
                      ) : state.kind === "paid" ? (
                        "Cambiar a este plan"
                      ) : (
                        "Pagar con tarjeta"
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {isOwner && state.kind !== "paid" && (
            <p className="text-xs text-muted-foreground">
              El pago se hace en la página segura de Stripe. Se cobra cada mes y puedes cancelar
              cuando quieras.
              {state.kind === "trial" &&
                state.daysLeft > 2 &&
                " No se cobra nada hasta que termine la prueba."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function StatusSummary({
  state,
  planName,
  waiting,
}: {
  state: ReturnType<typeof billingState>;
  planName?: string;
  waiting: boolean;
}) {
  if (waiting) {
    return <p className="text-sm text-foreground">Confirmando el pago con Stripe…</p>;
  }
  switch (state.kind) {
    case "exempt":
      return (
        <p className="text-sm text-foreground">
          Plan <strong>{planName ?? "—"}</strong> sin coste. No tienes que pagar nada.
        </p>
      );
    case "paid":
      return (
        <p className="text-sm text-foreground">
          Plan <strong>{planName ?? "—"}</strong> activo.{" "}
          {state.periodEnd &&
            (state.cancelAtPeriodEnd
              ? `Cancelado: podrás usarlo hasta el ${formatDate(state.periodEnd)}.`
              : `Próximo cobro: ${formatDate(state.periodEnd)}.`)}
        </p>
      );
    case "trial":
      return (
        <p className="text-sm text-foreground">
          Estás en la <strong>prueba gratis</strong>: te{" "}
          {state.daysLeft === 1 ? "queda 1 día" : `quedan ${state.daysLeft} días`} (hasta el{" "}
          {formatDate(state.endsAt)}). Elige un plan para seguir usando Garage después.
        </p>
      );
    case "blocked":
      return (
        <p className="text-sm text-[var(--destructive)]">
          {state.reason === "payment_failed"
            ? "No se pudo cobrar la suscripción. Actualiza la tarjeta en «Gestionar pago» para seguir trabajando. Tus datos están a salvo."
            : state.reason === "canceled"
              ? "La suscripción está cancelada. Elige un plan para volver a usar Garage. Tus datos están a salvo."
              : "La prueba gratis ha terminado. Elige un plan para seguir usando Garage. Tus datos están a salvo."}
        </p>
      );
  }
}
