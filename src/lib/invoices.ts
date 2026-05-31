// Talleo — invoice (facturación) domain logic. Generates invoices from a work
// order's approved quote lines, assigns a per-tenant sequential number and
// manages the simulated payment status. All persistence goes through the repos;
// no component touches localStorage directly. 100% local & simulated.

import type { Invoice, Tenant, WorkOrder } from "@/types";
import { invoicesRepo, notificationsRepo, vehiclesRepo } from "@/lib/db";
import { quoteTotals } from "@/lib/orders";

/** Find the invoice generated for a given work order, if any. */
export function getInvoiceByWorkOrderId(
  tenantId: string,
  workOrderId: string,
): Invoice | undefined {
  return invoicesRepo
    .list(tenantId)
    .find((i) => i.workOrderId === workOrderId);
}

/**
 * Next sequential invoice number for the tenant, scoped to the current year.
 * Format: F-YYYY-NNNN (e.g. F-2026-0001).
 */
export function nextInvoiceNumber(tenantId: string): string {
  const year = new Date().getFullYear();
  const prefix = `F-${year}-`;
  const existing = invoicesRepo
    .list(tenantId)
    .filter((i) => i.number.startsWith(prefix));
  let max = 0;
  for (const inv of existing) {
    const n = parseInt(inv.number.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function vehicleLabel(tenantId: string, vehicleId: string): string {
  const v = vehiclesRepo.getById(tenantId, vehicleId);
  return v ? `${v.make} ${v.model} · ${v.plate}` : "Vehículo";
}

/**
 * Generate an invoice from a work order, copying only the approved quote lines
 * and computing subtotal/tax/total with the tenant's taxRate. Returns undefined
 * if there are no approved lines. Initial payment status is `pending`.
 */
export function generateInvoiceFromOrder(
  tenant: Tenant,
  order: WorkOrder,
): Invoice | undefined {
  const approved = order.items.filter((i) => i.approval === "approved");
  if (approved.length === 0) return undefined;

  const { subtotal, tax, total } = quoteTotals(approved, tenant.taxRate);
  const now = new Date().toISOString();

  const invoice = invoicesRepo.create(tenant.id, {
    tenantId: tenant.id,
    workOrderId: order.id,
    number: nextInvoiceNumber(tenant.id),
    items: approved.map((i) => ({ ...i })),
    subtotal,
    tax,
    total,
    status: "pending",
    createdAt: now,
  });

  notificationsRepo.create(tenant.id, {
    tenantId: tenant.id,
    type: "presupuesto",
    title: "Factura generada",
    body: `${invoice.number} — ${vehicleLabel(tenant.id, order.vehicleId)}.`,
    read: false,
    createdAt: now,
  });

  return invoice;
}

/** Change the payment status of an invoice. */
export function setInvoiceStatus(
  tenantId: string,
  invoiceId: string,
  status: Invoice["status"],
): Invoice | undefined {
  return invoicesRepo.update(tenantId, invoiceId, { status });
}

export const INVOICE_STATUS_LABELS: Record<Invoice["status"], string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagada",
};
