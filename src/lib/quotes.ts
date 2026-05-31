// Talleo — quote (presupuesto) domain logic. Centralizes adding/editing/removing
// quote lines and the simulated "send quote to customer" flow. All persistence
// goes through the repos; no component touches localStorage directly.

import type { QuoteItem, Tenant, WorkOrder } from "@/types";
import {
  notificationsRepo,
  uid,
  vehiclesRepo,
  workOrdersRepo,
} from "@/lib/db";
import { PIPELINE, changeOrderStatus, quoteTotals } from "@/lib/orders";

export type ApprovalDecision = "approved" | "rejected";

export interface QuoteItemInput {
  type: QuoteItem["type"];
  description: string;
  qty: number;
  unitPrice: number;
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

  notificationsRepo.create(tenant.id, {
    tenantId: tenant.id,
    type: "presupuesto",
    title: "Presupuesto enviado",
    body: `${vehicleLabel(tenant.id, current.vehicleId)} — Presupuesto disponible para el cliente.`,
    read: false,
    createdAt: now,
  });

  return updated;
}
