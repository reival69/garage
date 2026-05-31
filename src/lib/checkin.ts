// Talleo — check-in (recepción) domain logic. Persists the reception snapshot
// into order.checkIn and keeps the vehicle's odometer in sync. All access goes
// through the repos; no component touches localStorage directly.

import type { BodyDamageMark, CheckIn, WorkOrder } from "@/types";
import { vehiclesRepo, workOrdersRepo } from "@/lib/db";

export interface CheckInInput {
  km: number;
  fuelLevel: number; // 0-100
  bodyDamage: BodyDamageMark[];
  customerSignature?: string;
}

/** Human label for a fuel level (0-100). */
export function fuelLabel(level: number): string {
  if (level <= 6) return "Vacío";
  if (level <= 31) return "1/4";
  if (level <= 56) return "1/2";
  if (level <= 81) return "3/4";
  return "Lleno";
}

/**
 * Persist the check-in into the order and update the vehicle odometer.
 * Keeps the original createdAt when editing an existing check-in.
 */
export function saveCheckIn(
  tenantId: string,
  order: WorkOrder,
  input: CheckInInput,
): WorkOrder | undefined {
  const checkIn: CheckIn = {
    km: input.km,
    fuelLevel: input.fuelLevel,
    bodyDamage: input.bodyDamage,
    customerSignature: input.customerSignature,
    createdAt: order.checkIn?.createdAt ?? new Date().toISOString(),
  };

  if (order.vehicleId) {
    const vehicle = vehiclesRepo.getById(tenantId, order.vehicleId);
    if (vehicle && Number.isFinite(input.km) && input.km >= 0) {
      vehiclesRepo.update(tenantId, order.vehicleId, { km: input.km });
    }
  }

  return workOrdersRepo.update(tenantId, order.id, {
    checkIn,
    updatedAt: new Date().toISOString(),
  });
}
