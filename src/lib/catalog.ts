// Talleo — Catálogo (servicios y repuestos) domain helpers. All data access
// goes through the repos. Everything is local & simulated.

import type { Service, Part } from "@/types";
import { appointmentsRepo, servicesRepo, partsRepo } from "@/lib/db";

/** Neutral label shown when a service id no longer exists in the catalog. */
export const MISSING_SERVICE_LABEL = "Servicio eliminado";

/**
 * Count appointments that still reference a given service and whose date is in
 * the future. Used to warn before deleting a service that's booked.
 */
export function futureAppointmentsUsingService(
  tenantId: string,
  serviceId: string,
): number {
  const now = Date.now();
  return appointmentsRepo
    .list(tenantId)
    .filter(
      (a) =>
        a.serviceIds.includes(serviceId) &&
        new Date(a.scheduledAt).getTime() >= now &&
        a.status !== "completada" &&
        a.status !== "no_show",
    ).length;
}

/** List services sorted by name. */
export function listServices(tenantId: string): Service[] {
  return servicesRepo.list(tenantId).sort((a, b) => a.name.localeCompare(b.name));
}

/** List parts sorted by name. */
export function listParts(tenantId: string): Part[] {
  return partsRepo.list(tenantId).sort((a, b) => a.name.localeCompare(b.name));
}
