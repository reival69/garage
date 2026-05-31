// Talleo — quote (presupuesto) domain logic. Centralizes adding/editing/removing
// quote lines and the simulated "send quote to customer" flow. All persistence
// goes through the repos; no component touches localStorage directly.

import type { QuoteItem, Tenant, WorkOrder } from "@/types";
import {
  uid,
  vehiclesRepo,
  workOrdersRepo,
} from "@/lib/db";
import { notify } from "@/lib/notifications";
import { PIPELINE, changeOrderStatus, quoteTotals } from "@/lib/orders";

export type ApprovalDecision = "approved" | "rejected";

export interface QuoteItemInput {
  type: QuoteItem["type"];
  description: string;
  qty: number;
  unitPrice: number;
  warrantyMonths?: number;
  warrantyKm?: number;
}

/** Per-line amount = qty × unitPrice. */
export function lineAmount(item: Pick<QuoteItem, "qty" | "unitPrice">): number {
  return item.qty * item.unitPrice;
}

/** Count of lines by approval state. */
export function quoteSummary(items: QuoteItem[]) {
  return {
    total: items.length,
    pending: items.filter((i) => i.approval === "pending").length,
    approved: items.filter((i) => i.approval === "approved").length,
    rejected: items.filter((i) => i.approval === "rejected").length,
  };
}

/** Add a new quote line; it always starts as `pending`. */
export function addQuoteItem(
  tenantId: string,
  order: WorkOrder,
  input: QuoteItemInput,
): WorkOrder | undefined {
  const item: QuoteItem = {
    id: uid("qi"),
    type: input.type,
    description: input.description.trim(),
    qty: input.qty,
    unitPrice: input.unitPrice,
    approval: "pending",
    warrantyMonths: input.warrantyMonths,
    warrantyKm: input.warrantyKm,
  };
  return workOrdersRepo.update(tenantId, order.id, {
    items: [...order.items, item],
    updatedAt: new Date().toISOString(),
  });
}

/** Edit an existing quote line's editable fields (type/description/qty/price). */
export function updateQuoteItem(
  tenantId: string,
  order: WorkOrder,
  itemId: string,
  patch: Partial<QuoteItemInput>,
): WorkOrder | undefined {
  const items = order.items.map((it) =>
    it.id === itemId
      ? {
          ...it,
          ...patch,
          description:
            patch.description !== undefined
              ? patch.description.trim()
              : it.description,
        }
      : it,
  );
  return workOrdersRepo.update(tenantId, order.id, {
    items,
    updatedAt: new Date().toISOString(),
  });
}

/** Remove a quote line. */
export function removeQuoteItem(
  tenantId: string,
  order: WorkOrder,
  itemId: string,
): WorkOrder | undefined {
  return workOrdersRepo.update(tenantId, order.id, {
    items: order.items.filter((it) => it.id !== itemId),
    updatedAt: new Date().toISOString(),
  });
}

function vehicleLabel(tenantId: string, vehicleId: string): string {
  const v = vehiclesRepo.getById(tenantId, vehicleId);
  return v ? `${v.make} ${v.model} · ${v.plate}` : "Vehículo";
}

/**
 * Simulate sending the quote to the customer: if the order is before
 * `presupuesto_enviado`, advance it (reusing changeOrderStatus). Always add a
 * `presupuesto` notification + a customer-visible shop message. Lines stay
 * `pending` — the real approval happens from the customer view later.
 */
export function sendQuote(
  tenant: Tenant,
  order: WorkOrder,
): WorkOrder | undefined {
  let current = order;
  const idx = PIPELINE.indexOf(order.status);
  const sentIdx = PIPELINE.indexOf("presupuesto_enviado");
  if (idx >= 0 && idx < sentIdx) {
    current = changeOrderStatus(tenant, order, "presupuesto_enviado") ?? order;
  }

  const now = new Date().toISOString();
  const messages = [
    ...current.messages,
    {
      id: uid("m"),
      from: "shop" as const,
      text: "Hemos preparado tu presupuesto, puedes revisarlo y aprobarlo desde aquí.",
      createdAt: now,
    },
  ];
  const updated = workOrdersRepo.update(tenant.id, current.id, {
    messages,
    updatedAt: now,
  });

  notify(tenant.id, {
    type: "presupuesto",
    title: "Presupuesto enviado",
    body: `${vehicleLabel(tenant.id, current.vehicleId)} — Presupuesto disponible para el cliente.`,
    link: `/app/ordenes/${current.id}`,
  });

  return updated;
}

/**
 * Totals for the lines the customer has approved, factoring in pending
 * decisions held locally in the guest view. `decisions` overlays the stored
 * approval state so the customer sees the approved total update live.
 */
export function approvedTotals(
  items: QuoteItem[],
  taxRate: number,
  decisions: Record<string, ApprovalDecision> = {},
) {
  const effective = items.map((it) =>
    decisions[it.id] ? { ...it, approval: decisions[it.id] } : it,
  );
  return quoteTotals(
    effective.filter((i) => i.approval === "approved"),
    taxRate,
  );
}

/**
 * Apply the customer's quote decisions (from the guest view): set each line's
 * approval, store the approval signature, advance the order to `aprobado` when
 * at least one line is approved, notify the shop and add a customer message.
 */
export function confirmQuoteApproval(
  tenant: Tenant,
  order: WorkOrder,
  decisions: Record<string, ApprovalDecision>,
  signature: string,
): WorkOrder | undefined {
  const now = new Date().toISOString();

  const items = order.items.map((it) =>
    decisions[it.id] ? { ...it, approval: decisions[it.id] } : it,
  );

  let updated = workOrdersRepo.update(tenant.id, order.id, {
    items,
    quoteApproval: { signature, decidedAt: now },
    updatedAt: now,
  });
  if (!updated) return undefined;

  const anyApproved = items.some((i) => i.approval === "approved");
  if (anyApproved && order.status === "presupuesto_enviado") {
    updated = changeOrderStatus(tenant, updated, "aprobado") ?? updated;
  }

  const newApproved = Object.values(decisions).filter(
    (d) => d === "approved",
  ).length;
  const newRejected = Object.values(decisions).filter(
    (d) => d === "rejected",
  ).length;
  let text = "He rechazado el presupuesto.";
  if (newApproved > 0 && newRejected === 0) text = "He aprobado el presupuesto.";
  else if (newApproved > 0 && newRejected > 0)
    text = "He aprobado parcialmente el presupuesto.";

  updated =
    workOrdersRepo.update(tenant.id, updated.id, {
      messages: [
        ...updated.messages,
        { id: uid("m"), from: "customer" as const, text, createdAt: now },
      ],
      updatedAt: now,
    }) ?? updated;

  notify(tenant.id, {
    type: "presupuesto",
    title: "Decisión del cliente",
    body: `${vehicleLabel(tenant.id, updated.vehicleId)} — ${text}`,
    link: `/app/ordenes/${updated.id}`,
  });

  return updated;
}

