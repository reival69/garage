// Talleo — stock / inventory domain logic. Extends the parts catalog with
// inventory: current units, minimum desired units and warehouse location.
// Connects to the order flow (decrement on invoice) and the notification
// center (low-stock alerts). All access goes through partsRepo; everything is
// local & simulated.

import type { Invoice, Part } from "@/types";
import { partsRepo } from "@/lib/db";
import { notify } from "@/lib/notifications";

/** Parts sorted by name (the inventory listing). */
export function listStock(tenantId: string): Part[] {
  return partsRepo.list(tenantId).sort((a, b) => a.name.localeCompare(b.name));
}

/** Is a part at or below its minimum stock? (only meaningful when minStock set) */
export function isLowStock(part: Part): boolean {
  const min = part.minStock ?? 0;
  const qty = part.stockQty ?? 0;
  if (min <= 0) return false;
  return qty <= min;
}

/**
 * Adjust the stock of a part by `delta` (positive = entrada, negative = salida).
 * Never goes below 0. When restocked above the minimum, re-arms the low-stock
 * notification so it can fire again next time it drops. Returns the saved Part.
 */
export function adjustStock(
  tenantId: string,
  partId: string,
  delta: number,
): Part | undefined {
  const part = partsRepo.getById(tenantId, partId);
  if (!part) return undefined;
  const next = Math.max(0, (part.stockQty ?? 0) + delta);
  const patch: Partial<Part> = { stockQty: next };
  // If it's back above the minimum, allow the alert to fire again later.
  if (part.lowStockNotified && next > (part.minStock ?? 0)) {
    patch.lowStockNotified = false;
  }
  return partsRepo.update(tenantId, partId, patch);
}

/**
 * Emit a `recordatorio` notification for every part at/below its minimum stock
 * that hasn't notified yet, then mark it so it only fires once. When a part is
 * restocked above the minimum, its flag is reset (here and in adjustStock).
 * Runs on shop view load, mirroring evaluateReminders().
 */
export function evaluateLowStock(tenantId: string): number {
  let emitted = 0;
  for (const part of partsRepo.list(tenantId)) {
    const low = isLowStock(part);
    if (!low) {
      // Reset the flag once it's back above the minimum.
      if (part.lowStockNotified) {
        partsRepo.update(tenantId, part.id, { lowStockNotified: false });
      }
      continue;
    }
    if (part.lowStockNotified) continue;
    notify(tenantId, {
      type: "recordatorio",
      title: "Repuesto bajo stock",
      body: `${part.name} — quedan ${part.stockQty ?? 0} (mín. ${part.minStock ?? 0}).`,
      link: "/app/stock",
    });
    partsRepo.update(tenantId, part.id, { lowStockNotified: true });
    emitted += 1;
  }
  return emitted;
}

/** Count of parts currently at/below their minimum stock (for the dashboard). */
export function lowStockCount(tenantId: string): number {
  return partsRepo.list(tenantId).filter(isLowStock).length;
}

/**
 * Decrement stock for every invoice line linked to a catalog part (partId),
 * by its quantity. Clamps at 0 and flags the part as low when it drops to/below
 * the minimum. Intended to run ONCE, at invoice generation.
 */
export function decrementStockForInvoice(invoice: Invoice): void {
  for (const item of invoice.items) {
    if (item.type !== "part" || !item.partId) continue;
    const part = partsRepo.getById(invoice.tenantId, item.partId);
    if (!part) continue;
    const next = Math.max(0, (part.stockQty ?? 0) - item.qty);
    const patch: Partial<Part> = { stockQty: next };
    if ((part.minStock ?? 0) > 0 && next <= (part.minStock ?? 0)) {
      // Mark low; evaluateLowStock will emit the notification on next load.
      patch.lowStockNotified = false;
    }
    partsRepo.update(invoice.tenantId, part.id, patch);
  }
}
