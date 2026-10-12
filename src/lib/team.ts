// Garage — team helpers (shop users). All access goes through usersRepo.
// Guards live here so the UI can stay declarative. Local & simulated.

import { usersRepo, workOrdersRepo } from "@/lib/db";
import type { User } from "@/types";

/** Users belonging to a tenant (the system superadmin has tenantId null). */
export function listTeam(tenantId: string): User[] {
  return usersRepo.list().filter((u) => u.tenantId === tenantId);
}

/** Total owners in the tenant (active or not). */
export function countOwners(tenantId: string): number {
  return listTeam(tenantId).filter((u) => u.role === "owner").length;
}

/** Active owners in the tenant. */
export function countActiveOwners(tenantId: string): number {
  return listTeam(tenantId).filter(
    (u) => u.role === "owner" && u.active !== false,
  ).length;
}

/** How many work orders reference this user as mechanic. */
export function mechanicOrderCount(tenantId: string, userId: string): number {
  return workOrdersRepo
    .list(tenantId)
    .filter((o) => o.mechanicId === userId).length;
}

export const ROLE_LABELS: Record<User["role"], string> = {
  superadmin: "Superadmin",
  owner: "Propietario",
  staff: "Recepción",
  mechanic: "Mecánico",
};
