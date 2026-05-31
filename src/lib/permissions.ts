// Talleo — role-based permissions for the Taller (shop) views.
// Golden rule: the owner always has full access and is never restricted, so a
// teacher can never get locked out during a class demo.

import type { Role } from "@/types";

export type AppModule =
  | "dashboard"
  | "citas"
  | "clientes"
  | "vehiculos"
  | "ordenes"
  | "presupuestos"
  | "facturacion"
  | "servicios"
  | "recordatorios"
  | "resenas"
  | "equipo"
  | "configuracion";

// Modules each role can access. "all" = unrestricted (owner / superadmin).
const ACCESS: Record<Role, AppModule[] | "all"> = {
  superadmin: "all",
  owner: "all",
  staff: [
    "dashboard",
    "citas",
    "clientes",
    "vehiculos",
    "ordenes",
    "presupuestos",
    "facturacion",
    "servicios",
    "recordatorios",
    "resenas",
  ],
  mechanic: ["dashboard", "ordenes", "citas", "clientes", "vehiculos", "recordatorios"],
};

// Modules a role can see but only read (no create/edit/delete).
const READ_ONLY: Partial<Record<Role, AppModule[]>> = {
  mechanic: ["citas", "clientes", "vehiculos", "recordatorios"],
};

/** Can this role access (open) the given module at all? */
export function can(role: Role, module: AppModule): boolean {
  const access = ACCESS[role];
  if (access === "all") return true;
  return access.includes(module);
}

/** Can this role edit (write) within the given module? */
export function canEdit(role: Role, module: AppModule): boolean {
  if (!can(role, module)) return false;
  const ro = READ_ONLY[role];
  return !(ro?.includes(module) ?? false);
}

/** Map a /app/* pathname to its module (for the route guard). */
export function moduleForPath(pathname: string): AppModule | null {
  const p = pathname.replace(/\/+$/, "");
  if (p === "/app") return "dashboard";
  if (p.startsWith("/app/citas")) return "citas";
  if (p.startsWith("/app/clientes")) return "clientes";
  if (p.startsWith("/app/vehiculos")) return "vehiculos";
  if (p.startsWith("/app/ordenes")) return "ordenes";
  if (p.startsWith("/app/presupuestos")) return "presupuestos";
  if (p.startsWith("/app/facturacion")) return "facturacion";
  if (p.startsWith("/app/servicios")) return "servicios";
  if (p.startsWith("/app/recordatorios")) return "recordatorios";
  if (p.startsWith("/app/resenas")) return "resenas";
  if (p.startsWith("/app/equipo")) return "equipo";
  if (p.startsWith("/app/configuracion")) return "configuracion";
  return null;
}
