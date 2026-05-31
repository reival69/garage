// Talleo — vehicle domain logic. Centralizes the stable public access code used
// by the permanent cartilla (/v/:code), the cross-tenant lookup helpers and the
// "vigent warranty" computation. All access goes through the repos; everything
// is local & simulated.

import type { QuoteItem, Tenant, Vehicle, WorkOrder } from "@/types";
import { listAllVehicleAccessCodes, vehiclesRepo } from "@/lib/db";
import { getInvoiceByWorkOrderId } from "@/lib/invoices";
import { warrantyLabel } from "@/lib/quotes";

function code6(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Generate a 6-char vehicle access code unique across every tenant. */
export function generateUniqueVehicleAccessCode(): string {
  const used = new Set(
    listAllVehicleAccessCodes().map((c) => c.code.toUpperCase()),
  );
  let c = code6();
  let guard = 0;
  while (used.has(c) && guard < 50) {
    c = code6();
    guard++;
  }
  return c;
}

/** Relative path to a vehicle's permanent cartilla. */
export function cartillaPath(code: string): string {
  return `/v/${code}`;
}

/** Absolute, shareable URL to a vehicle's permanent cartilla. */
export function cartillaUrl(code: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/v/${code}`;
  }
  return `/v/${code}`;
}

/** Build a wa.me URL to share the cartilla with the customer (URLs only). */
export function whatsappCartillaUrl(opts: {
  phone?: string;
  tenantName: string;
  customerName?: string;
  vehicleLabel?: string;
  code: string;
}): string {
  const digits = (opts.phone ?? "").replace(/\D/g, "");
  const greeting = opts.customerName ? `Hola ${opts.customerName}, ` : "Hola, ";
  const vehiclePart = opts.vehicleLabel ? ` de tu ${opts.vehicleLabel}` : "";
  const msg =
    `${greeting}te compartimos desde ${opts.tenantName} la cartilla digital${vehiclePart}. ` +
    `Aquí tienes el historial completo, garantías y próximas revisiones: ${cartillaUrl(opts.code)}`;
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(msg)}`;
}

/** The vehicle's active (in-progress) order, if any. Expects newest-first list. */
export function findActiveOrder(orders: WorkOrder[]): WorkOrder | undefined {
  return orders.find(
    (o) => o.status !== "entregado" && o.status !== "cancelado",
  );
}

export interface ActiveWarranty {
  order: WorkOrder;
  item: QuoteItem;
  label: string;
  /** Date the warranty expires (when a month limit applies). */
  untilDate?: string;
  /** Odometer at which the warranty expires (when a km limit applies). */
  untilKm?: number;
}

/**
 * Compute whether a warranty line is still valid given the order's delivery
 * date and the vehicle's current odometer. When both limits apply, the warranty
 * is valid only while BOTH still hold (whichever limit is reached first ends it).
 */
function evaluateWarranty(
  item: QuoteItem,
  order: WorkOrder,
  vehicle: Vehicle,
  deliveryIso: string,
): ActiveWarranty | null {
  const hasMonths = item.warrantyMonths != null && item.warrantyMonths > 0;
  const hasKm = item.warrantyKm != null && item.warrantyKm > 0;
  if (!hasMonths && !hasKm) return null;

  const now = new Date();
  let untilDate: string | undefined;
  let monthsOk = true;
  if (hasMonths) {
    const expiry = new Date(deliveryIso);
    expiry.setMonth(expiry.getMonth() + (item.warrantyMonths as number));
    untilDate = expiry.toISOString();
    monthsOk = expiry > now;
  }

  let untilKm: number | undefined;
  let kmOk = true;
  if (hasKm) {
    // Odometer at the time of service (fallback: can't determine → treat as valid).
    const serviceKm = order.checkIn?.km;
    if (serviceKm != null) {
      untilKm = serviceKm + (item.warrantyKm as number);
      kmOk = vehicle.km < untilKm;
    }
  }

  const active =
    hasMonths && hasKm ? monthsOk && kmOk : hasMonths ? monthsOk : kmOk;
  if (!active) return null;

  return {
    order,
    item,
    label: warrantyLabel(item) ?? "",
    untilDate,
    untilKm,
  };
}

/**
 * Every still-valid warranty line across the vehicle's delivered orders.
 * Only approved lines from delivered orders carry an active warranty.
 */
export function listActiveWarranties(
  tenantId: string,
  vehicle: Vehicle,
  orders: WorkOrder[],
): ActiveWarranty[] {
  const out: ActiveWarranty[] = [];
  for (const order of orders) {
    if (order.status !== "entregado") continue;
    const invoice = getInvoiceByWorkOrderId(tenantId, order.id);
    const deliveryIso = invoice?.createdAt ?? order.updatedAt;
    for (const item of order.items) {
      if (item.approval !== "approved") continue;
      const w = evaluateWarranty(item, order, vehicle, deliveryIso);
      if (w) out.push(w);
    }
  }
  return out;
}

/** Look up the latest odometer reading for display convenience. */
export function vehicleById(tenantId: string, id: string): Vehicle | undefined {
  return vehiclesRepo.getById(tenantId, id);
}
