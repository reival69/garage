// Talleo — maintenance reminders domain logic. Reminders are tied to a vehicle
// and become "due" by date and/or odometer. When a shop view loads,
// evaluateReminders() emits a `recordatorio` notification (once) for every
// overdue pending reminder so it surfaces in the existing notification center.
// All access goes through the repos; everything is local & simulated.

import type { MaintenanceReminder, Vehicle } from "@/types";
import { remindersRepo, vehiclesRepo } from "@/lib/db";
import { notify } from "@/lib/notifications";

export interface ReminderInput {
  vehicleId: string;
  customerId: string;
  label: string;
  dueDate?: string;
  dueKm?: number;
  note?: string;
}

/** Create a new pending reminder for a vehicle. */
export function createReminder(
  tenantId: string,
  input: ReminderInput,
): MaintenanceReminder {
  return remindersRepo.create(tenantId, {
    tenantId,
    vehicleId: input.vehicleId,
    customerId: input.customerId,
    label: input.label.trim(),
    dueDate: input.dueDate || undefined,
    dueKm: input.dueKm,
    note: input.note?.trim() || undefined,
    status: "pending",
    notified: false,
    createdAt: new Date().toISOString(),
  } as Omit<MaintenanceReminder, "id">);
}

/** Update an existing reminder (label, dates, etc.). */
export function updateReminder(
  tenantId: string,
  id: string,
  patch: Partial<MaintenanceReminder>,
): MaintenanceReminder | undefined {
  return remindersRepo.update(tenantId, id, patch);
}

/** Delete a reminder. */
export function removeReminder(tenantId: string, id: string): void {
  remindersRepo.remove(tenantId, id);
}

/** All reminders for a tenant, soonest due first. */
export function listReminders(tenantId: string): MaintenanceReminder[] {
  return remindersRepo.list(tenantId).slice().sort(byDueAsc);
}

/** Reminders for a single vehicle (newest first). */
export function listVehicleReminders(
  tenantId: string,
  vehicleId: string,
): MaintenanceReminder[] {
  return remindersRepo
    .list(tenantId)
    .filter((r) => r.vehicleId === vehicleId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Is a reminder overdue right now (by date or by odometer)? */
export function isReminderDue(
  reminder: MaintenanceReminder,
  vehicle?: Vehicle,
): boolean {
  if (reminder.status !== "pending") return false;
  const byDate = !!reminder.dueDate && new Date(reminder.dueDate) <= new Date();
  const byKm =
    reminder.dueKm != null &&
    !!vehicle &&
    typeof vehicle.km === "number" &&
    vehicle.km >= reminder.dueKm;
  return byDate || byKm;
}

/** Overdue pending reminders for a tenant. */
export function dueReminders(tenantId: string): MaintenanceReminder[] {
  return remindersRepo
    .list(tenantId)
    .filter((r) =>
      isReminderDue(r, vehiclesRepo.getById(tenantId, r.vehicleId)),
    )
    .sort(byDueAsc);
}

/**
 * Emit a notification for every overdue pending reminder that hasn't notified
 * yet, then mark it as notified so it only fires once. Runs on shop view load.
 */
export function evaluateReminders(tenantId: string): number {
  let emitted = 0;
  for (const r of remindersRepo.list(tenantId)) {
    if (r.status !== "pending" || r.notified) continue;
    const vehicle = vehiclesRepo.getById(tenantId, r.vehicleId);
    if (!isReminderDue(r, vehicle)) continue;
    const vLabel = vehicle
      ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate}`
      : "Vehículo";
    notify(tenantId, {
      type: "recordatorio",
      title: "Revisión pendiente",
      body: `${r.label} — ${vLabel}.`,
      link: "/app/recordatorios",
    });
    remindersRepo.update(tenantId, r.id, { notified: true });
    emitted += 1;
  }
  return emitted;
}

/** Mark a reminder as done. */
export function markDone(tenantId: string, id: string): void {
  remindersRepo.update(tenantId, id, { status: "done" });
}

/** Dismiss a reminder (no longer relevant). */
export function dismiss(tenantId: string, id: string): void {
  remindersRepo.update(tenantId, id, { status: "dismissed" });
}

/** Sort: those with a due date first (soonest first), then km-only, then rest. */
function byDueAsc(a: MaintenanceReminder, b: MaintenanceReminder): number {
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return (a.dueKm ?? Infinity) - (b.dueKm ?? Infinity);
}

/** Build a wa.me URL with a prefilled maintenance message (opens WhatsApp). */
export function whatsappReminderUrl(opts: {
  phone?: string;
  tenantName: string;
  customerName?: string;
  vehicleLabel?: string;
  label: string;
}): string {
  const digits = (opts.phone ?? "").replace(/\D/g, "");
  const greeting = opts.customerName ? `Hola ${opts.customerName}, ` : "Hola, ";
  const vehiclePart = opts.vehicleLabel ? ` de tu ${opts.vehicleLabel}` : "";
  const msg =
    `${greeting}te escribimos desde ${opts.tenantName}. ` +
    `Te recordamos que toca "${opts.label}"${vehiclePart}. ` +
    `¿Quieres que te demos cita?`;
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(msg)}`;
}
