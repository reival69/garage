// Talleo — entity repositories. The single API surface components use to read
// and write domain data. Swap storage.ts internals to migrate to a real DB
// without touching components.

import type {
  Appointment,
  Customer,
  Invoice,
  Part,
  Plan,
  Service,
  Tenant,
  User,
  Vehicle,
  WorkOrder,
  AppNotification,
} from "@/types";
import {
  GLOBAL,
  listTenantIdsWithCollection,
  read,
  uid,
  write,
} from "./storage";

interface Identifiable {
  id: string;
}

/** Repository scoped to a single tenant (tenantId required on every call). */
function tenantRepo<T extends Identifiable>(collection: string) {
  return {
    list(tenantId: string): T[] {
      return read<T>(collection, tenantId);
    },
    getById(tenantId: string, id: string): T | undefined {
      return read<T>(collection, tenantId).find((x) => x.id === id);
    },
    create(tenantId: string, item: Omit<T, "id"> & { id?: string }): T {
      const items = read<T>(collection, tenantId);
      const created = { ...item, id: item.id ?? uid(collection) } as T;
      items.push(created);
      write(collection, tenantId, items);
      return created;
    },
    update(tenantId: string, id: string, patch: Partial<T>): T | undefined {
      const items = read<T>(collection, tenantId);
      const idx = items.findIndex((x) => x.id === id);
      if (idx === -1) return undefined;
      items[idx] = { ...items[idx], ...patch };
      write(collection, tenantId, items);
      return items[idx];
    },
    remove(tenantId: string, id: string): void {
      const items = read<T>(collection, tenantId).filter((x) => x.id !== id);
      write(collection, tenantId, items);
    },
  };
}

/** Repository for global collections (stored under talleo:global:*). */
function globalRepo<T extends Identifiable>(collection: string) {
  return {
    list(): T[] {
      return read<T>(collection, GLOBAL);
    },
    getById(id: string): T | undefined {
      return read<T>(collection, GLOBAL).find((x) => x.id === id);
    },
    create(item: Omit<T, "id"> & { id?: string }): T {
      const items = read<T>(collection, GLOBAL);
      const created = { ...item, id: item.id ?? uid(collection) } as T;
      items.push(created);
      write(collection, GLOBAL, items);
      return created;
    },
    update(id: string, patch: Partial<T>): T | undefined {
      const items = read<T>(collection, GLOBAL);
      const idx = items.findIndex((x) => x.id === id);
      if (idx === -1) return undefined;
      items[idx] = { ...items[idx], ...patch };
      write(collection, GLOBAL, items);
      return items[idx];
    },
    remove(id: string): void {
      const items = read<T>(collection, GLOBAL).filter((x) => x.id !== id);
      write(collection, GLOBAL, items);
    },
  };
}

// Global collections
export const plansRepo = globalRepo<Plan>("plans");
export const tenantsRepo = globalRepo<Tenant>("tenants");
export const usersRepo = globalRepo<User>("users");

/** Find a tenant by its public slug (used by the public booking page /t/:slug). */
export function findTenantBySlug(slug: string): Tenant | undefined {
  const normalized = slug.trim().toLowerCase();
  return tenantsRepo.list().find((t) => t.slug.toLowerCase() === normalized);
}

// Tenant-scoped collections
export const customersRepo = tenantRepo<Customer>("customers");
export const vehiclesRepo = tenantRepo<Vehicle>("vehicles");
export const workOrdersRepo = tenantRepo<WorkOrder>("workorders");
export const invoicesRepo = tenantRepo<Invoice>("invoices");
export const appointmentsRepo = tenantRepo<Appointment>("appointments");
export const servicesRepo = tenantRepo<Service>("services");
export const partsRepo = tenantRepo<Part>("parts");
export const notificationsRepo = tenantRepo<AppNotification>("notifications");

/** Find a work order across ALL tenants by its 6-char access code (guest view). */
export function findWorkOrderByAccessCode(
  code: string,
): { order: WorkOrder; tenant: Tenant } | undefined {
  const normalized = code.trim().toUpperCase();
  const tenantIds = listTenantIdsWithCollection("workorders");
  for (const tenantId of tenantIds) {
    const order = read<WorkOrder>("workorders", tenantId).find(
      (o) => o.accessCode.toUpperCase() === normalized,
    );
    if (order) {
      const tenant = tenantsRepo.getById(order.tenantId);
      if (tenant) return { order, tenant };
    }
  }
  return undefined;
}

/** Collect every access code in use (for the demo switcher customer picker). */
export function listAllAccessCodes(): Array<{
  code: string;
  tenantId: string;
  tenantName: string;
  vehicle: string;
}> {
  const result: Array<{
    code: string;
    tenantId: string;
    tenantName: string;
    vehicle: string;
  }> = [];
  const tenantIds = listTenantIdsWithCollection("workorders");
  for (const tenantId of tenantIds) {
    const tenant = tenantsRepo.getById(tenantId);
    const orders = read<WorkOrder>("workorders", tenantId);
    for (const o of orders) {
      const vehicle = vehiclesRepo.getById(tenantId, o.vehicleId);
      result.push({
        code: o.accessCode,
        tenantId,
        tenantName: tenant?.name ?? tenantId,
        vehicle: vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` : "—",
      });
    }
  }
  return result;
}
