// Talleo — appointment (agenda) domain logic. All data access goes through the
// repos. Centralizes status transitions, duration estimation and the bridge
// that turns an appointment into a work order. Everything is local & simulated.

import type {
  Appointment,
  AppointmentStatus,
  Service,
  Tenant,
  WorkOrder,
} from "@/types";
import {
  appointmentsRepo,
  servicesRepo,
  vehiclesRepo,
} from "@/lib/db";
import { notify } from "@/lib/notifications";
import { createWorkOrder } from "@/lib/orders";

// Linear flow of an appointment. `no_show` is an alternative terminal outcome.
export const APPOINTMENT_FLOW: AppointmentStatus[] = [
  "programada",
  "confirmada",
  "en_taller",
  "completada",
];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  en_taller: "En taller",
  completada: "Completada",
  no_show: "No presentado",
};

/**
 * Allowed transitions: advance one step in the flow plus the `no_show` outcome
 * while the customer hasn't arrived. Terminal states have no transitions.
 */
export function nextAppointmentStatuses(
  current: AppointmentStatus,
): AppointmentStatus[] {
  if (current === "completada" || current === "no_show") return [];
  const out: AppointmentStatus[] = [];
  const idx = APPOINTMENT_FLOW.indexOf(current);
  if (idx >= 0 && idx < APPOINTMENT_FLOW.length - 1) {
    out.push(APPOINTMENT_FLOW[idx + 1]);
  }
  if (current === "programada" || current === "confirmada") {
    out.push("no_show");
  }
  return out;
}

/** Total estimated minutes for the appointment's selected services. */
export function appointmentDuration(
  tenantId: string,
  serviceIds: string[],
): number {
  if (serviceIds.length === 0) return 0;
  const byId = new Map<string, Service>();
  servicesRepo.list(tenantId).forEach((s) => byId.set(s.id, s));
  return serviceIds.reduce((sum, id) => sum + (byId.get(id)?.estimatedMinutes ?? 0), 0);
}

/** Human-readable duration, e.g. "1 h 30 min". */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function listServiceNames(
  tenantId: string,
  serviceIds: string[],
): string[] {
  const byId = new Map<string, Service>();
  servicesRepo.list(tenantId).forEach((s) => byId.set(s.id, s));
  return serviceIds.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
}

/**
 * Like {@link listServiceNames}, but keeps orphaned ids visible with a neutral
 * "Servicio eliminado" label so deleting a service never makes an appointment
 * look empty or crash the view.
 */
export function listServiceLabels(
  tenantId: string,
  serviceIds: string[],
): string[] {
  const byId = new Map<string, Service>();
  servicesRepo.list(tenantId).forEach((s) => byId.set(s.id, s));
  return serviceIds.map((id) => byId.get(id)?.name ?? "Servicio eliminado");
}

interface AppointmentInput {
  customerId?: string;
  vehicleId?: string;
  serviceIds: string[];
  scheduledAt: string;
  notes?: string;
}

/** Create a new appointment in `programada`, source `manual`. */
export function createAppointment(
  tenant: Tenant,
  input: AppointmentInput,
): Appointment {
  const appt = appointmentsRepo.create(tenant.id, {
    tenantId: tenant.id,
    locationId: tenant.locations[0]?.id ?? "",
    customerId: input.customerId || undefined,
    vehicleId: input.vehicleId || undefined,
    serviceIds: input.serviceIds,
    scheduledAt: input.scheduledAt,
    status: "programada",
    source: "manual",
    notes: input.notes?.trim() || undefined,
  } as Omit<Appointment, "id">);
  return appt;
}

/** Update an existing appointment's editable fields. */
export function updateAppointment(
  tenantId: string,
  id: string,
  input: AppointmentInput,
): Appointment | undefined {
  return appointmentsRepo.update(tenantId, id, {
    customerId: input.customerId || undefined,
    vehicleId: input.vehicleId || undefined,
    serviceIds: input.serviceIds,
    scheduledAt: input.scheduledAt,
    notes: input.notes?.trim() || undefined,
  });
}

/** Change the appointment status (with a simulated notification). */
export function changeAppointmentStatus(
  tenant: Tenant,
  appt: Appointment,
  next: AppointmentStatus,
): Appointment | undefined {
  const updated = appointmentsRepo.update(tenant.id, appt.id, { status: next });
  notify(tenant.id, {
    type: "cita",
    title: `Cita: ${APPOINTMENT_STATUS_LABELS[next]}`,
    body: vehicleLabel(tenant.id, appt.vehicleId),
    link: "/app/citas",
  });
  return updated;
}

function vehicleLabel(tenantId: string, vehicleId?: string): string {
  if (!vehicleId) return "Cita sin vehículo";
  const v = vehiclesRepo.getById(tenantId, vehicleId);
  return v ? `${v.make} ${v.model} · ${v.plate}` : "Vehículo";
}

/**
 * Bridge: create a work order from an appointment. Requires customer + vehicle.
 * Builds the problem description from notes + selected services, links the order
 * id back onto the appointment and marks it `en_taller`. Returns the new order.
 */
export function createOrderFromAppointment(
  tenant: Tenant,
  appt: Appointment,
): WorkOrder | undefined {
  if (!appt.customerId || !appt.vehicleId) return undefined;

  const services = listServiceNames(tenant.id, appt.serviceIds);
  const parts: string[] = [];
  if (appt.notes?.trim()) parts.push(appt.notes.trim());
  if (services.length > 0) parts.push(`Servicios: ${services.join(", ")}.`);
  const problemDescription =
    parts.join(" ") || "Recepción desde cita programada.";

  const order = createWorkOrder(tenant, {
    customerId: appt.customerId,
    vehicleId: appt.vehicleId,
    problemDescription,
  });

  appointmentsRepo.update(tenant.id, appt.id, {
    status: "en_taller",
    workOrderId: order.id,
  });

  return order;
}
