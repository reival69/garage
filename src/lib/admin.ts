// Garage — Superadmin (SaaS) global aggregation logic. Reads across every
// tenant namespace via the repos and exposes platform-wide metrics plus the
// CRUD used by the Superadmin panel. 100% local & simulated; no component
// touches localStorage directly.

import type { Plan, Tenant } from "@/types";
import {
  invoicesRepo,
  plansRepo,
  tenantsRepo,
  uid,
  usersRepo,
  workOrdersRepo,
} from "@/lib/db";
import { TRIAL_DAYS } from "@/lib/billing";

export interface TenantMetrics {
  tenant: Tenant;
  plan?: Plan;
  orderCount: number;
  /** Sum of paid invoices, in the tenant's own currency. */
  paidRevenue: number;
}

/** Per-tenant metrics aggregated across all tenant namespaces. */
export function tenantMetrics(): TenantMetrics[] {
  const plans = plansRepo.list();
  return tenantsRepo.list().map((tenant) => {
    const orderCount = workOrdersRepo.list(tenant.id).length;
    const paidRevenue = invoicesRepo
      .list(tenant.id)
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.total, 0);
    return {
      tenant,
      plan: plans.find((p) => p.id === tenant.planId),
      orderCount,
      paidRevenue,
    };
  });
}

export interface GlobalStats {
  activeTenants: number;
  suspendedTenants: number;
  /** Simulated MRR = sum of priceMonthly of active tenants' plans (in EUR). */
  mrr: number;
  totalOrders: number;
  /** Paid invoice totals grouped by currency (currencies are not summed). */
  revenueByCurrency: Record<string, number>;
}

export function globalStats(): GlobalStats {
  const metrics = tenantMetrics();
  let activeTenants = 0;
  let suspendedTenants = 0;
  let mrr = 0;
  let totalOrders = 0;
  const revenueByCurrency: Record<string, number> = {};

  for (const m of metrics) {
    if (m.tenant.status === "active") {
      activeTenants++;
      mrr += m.plan?.priceMonthly ?? 0;
    } else {
      suspendedTenants++;
    }
    totalOrders += m.orderCount;
    if (m.paidRevenue > 0) {
      revenueByCurrency[m.tenant.currency] =
        (revenueByCurrency[m.tenant.currency] ?? 0) + m.paidRevenue;
    }
  }

  return { activeTenants, suspendedTenants, mrr, totalOrders, revenueByCurrency };
}

/** Tenants ordered by number of work orders (most active first). */
export function mostActiveTenants(limit = 5): TenantMetrics[] {
  return [...tenantMetrics()]
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

export interface PlanUsage {
  plan: Plan;
  tenantCount: number;
}

/** Each plan with how many tenants are subscribed to it. */
export function planUsage(): PlanUsage[] {
  const tenants = tenantsRepo.list();
  return plansRepo.list().map((plan) => ({
    plan,
    tenantCount: tenants.filter((t) => t.planId === plan.id).length,
  }));
}

export interface TenantInput {
  name: string;
  slug: string;
  currency: string;
  taxRate: number;
  planId: string;
  accentColor: string;
  locationName: string;
  locationAddress?: string;
  /** Only when creating: the workshop owner's name and login email. */
  ownerName?: string;
  ownerEmail?: string;
  /** Never asked to pay (superadmin courtesy). */
  freeForever?: boolean;
  /** Edit only: new end of the free trial (ISO). */
  trialEndsAt?: string;
}

/**
 * Create a tenant and seed an owner user so support can "enter as" the shop.
 * The data namespace (talleo:{tenantId}:*) is implicit — collections start
 * empty and are created lazily on first write.
 */
export function createTenant(input: TenantInput): Tenant {
  const id = uid("tnt");
  const locId = uid("loc");
  const tenant = tenantsRepo.create({
    id,
    name: input.name.trim(),
    slug: input.slug.trim(),
    accentColor: input.accentColor,
    planId: input.planId,
    status: "active",
    currency: input.currency,
    taxRate: input.taxRate,
    locations: [
      {
        id: locId,
        tenantId: id,
        name: input.locationName.trim(),
        address: input.locationAddress?.trim() || undefined,
      },
    ],
    createdAt: new Date().toISOString(),
    billing: {
      exempt: !!input.freeForever,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  usersRepo.create({
    tenantId: id,
    name: input.ownerName?.trim() || `Owner ${tenant.name}`,
    email: input.ownerEmail?.trim().toLowerCase() || `owner@${tenant.slug}.app`,
    role: "owner",
    locationId: locId,
  });

  return tenant;
}

/** Update a tenant's editable fields (and its single location name/address). */
export function updateTenant(
  id: string,
  input: TenantInput,
): Tenant | undefined {
  const current = tenantsRepo.getById(id);
  if (!current) return undefined;
  const loc = current.locations[0];
  return tenantsRepo.update(id, {
    billing: {
      ...current.billing,
      exempt: !!input.freeForever,
      ...(input.trialEndsAt ? { trialEndsAt: input.trialEndsAt } : {}),
    },
    name: input.name.trim(),
    slug: input.slug.trim(),
    currency: input.currency,
    taxRate: input.taxRate,
    planId: input.planId,
    accentColor: input.accentColor,
    locations: [
      {
        id: loc?.id ?? uid("loc"),
        tenantId: id,
        name: input.locationName.trim(),
        address: input.locationAddress?.trim() || undefined,
      },
    ],
  });
}

/** Toggle a tenant between active and suspended. */
export function toggleTenantStatus(id: string): Tenant | undefined {
  const t = tenantsRepo.getById(id);
  if (!t) return undefined;
  return tenantsRepo.update(id, {
    status: t.status === "active" ? "suspended" : "active",
  });
}

/** The owner user of a tenant (used by "enter as this shop"). */
export function ownerUserForTenant(tenantId: string) {
  const users = usersRepo.list();
  return (
    users.find((u) => u.tenantId === tenantId && u.role === "owner") ??
    users.find((u) => u.tenantId === tenantId)
  );
}

/** Update an editable plan. */
export function updatePlan(id: string, patch: Partial<Plan>): Plan | undefined {
  return plansRepo.update(id, patch);
}
