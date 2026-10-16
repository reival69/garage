// Garage — who can read and write which documents (server only).
//
// Every request is checked here, never in the browser:
//   - superadmin: everything
//   - workshop users (owner/staff/mechanic): their own workshop only
//   - end customers (/c/:code, /v/:code): only the order or vehicle behind that code
//   - public booking page (/t/:slug): the workshop's public profile and services
import type { User } from "@/types";
import { db, GLOBAL_TENANT, rowsToDocs, type DocRow } from "./db.server";

export const TENANT_COLLECTIONS = new Set([
  "customers",
  "vehicles",
  "workorders",
  "invoices",
  "appointments",
  "services",
  "parts",
  "notifications",
  "reminders",
  "reviews",
  "agents",
]);
export const GLOBAL_COLLECTIONS = new Set(["plans", "tenants", "users"]);

export type GuestScope =
  | { kind: "order"; code: string }
  | { kind: "vehicle"; code: string }
  | { kind: "booking"; slug: string };

/** Detects a customer or public page from the URL path. */
export function guestScopeFromPath(pathname: string): GuestScope | null {
  const order = /^\/c\/([A-Za-z0-9]{4,12})\/?$/.exec(pathname);
  if (order) return { kind: "order", code: order[1].toUpperCase() };
  const vehicle = /^\/v\/([A-Za-z0-9]{4,12})\/?$/.exec(pathname);
  if (vehicle) return { kind: "vehicle", code: vehicle[1].toUpperCase() };
  const booking = /^\/t\/([a-z0-9-]{1,80})\/?$/i.exec(pathname);
  if (booking) return { kind: "booking", slug: booking[1].toLowerCase() };
  return null;
}

/** Strips private fields from users shown to customers (mechanic names only). */
function publicUser(data: Record<string, unknown>) {
  return {
    id: data.id,
    tenantId: data.tenantId,
    name: data.name,
    role: data.role,
    active: data.active,
  };
}

// ---- Reading ---------------------------------------------------------------

/** Everything a logged-in user may see. */
export async function docsForUser(user: User): Promise<DocRow[]> {
  const sql = await db();
  if (user.role === "superadmin") {
    return rowsToDocs(await sql`select tenant_id, collection, id, data from docs`);
  }
  const tenantId = user.tenantId ?? "";
  return rowsToDocs(
    await sql`
    select tenant_id, collection, id, data from docs
    where tenant_id = ${tenantId}
       or (tenant_id = ${GLOBAL_TENANT} and collection = 'plans')
       or (tenant_id = ${GLOBAL_TENANT} and collection = 'tenants' and id = ${tenantId})
       or (tenant_id = ${GLOBAL_TENANT} and collection = 'users' and data->>'tenantId' = ${tenantId})`,
  );
}

export interface ResolvedGuest {
  tenantId: string;
  /** Work orders the customer may update (approve quotes, sign…). */
  orderIds: Set<string>;
  docs: DocRow[];
}

/** Everything an end customer or a visitor of the booking page may see. */
export async function docsForGuest(scope: GuestScope): Promise<ResolvedGuest | null> {
  const sql = await db();
  let tenantId: string;
  let vehicleIds: string[] = [];
  let customerIds: string[] = [];
  let orderIds: string[] = [];
  let editableOrders: string[] = [];

  if (scope.kind === "booking") {
    const rows = await sql<{ id: string }[]>`
      select id from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'tenants'
        and lower(data->>'slug') = ${scope.slug} and data->>'status' = 'active'`;
    if (!rows[0]) return null;
    tenantId = rows[0].id;
  } else {
    const collection = scope.kind === "order" ? "workorders" : "vehicles";
    const rows = await sql<{ tenant_id: string; id: string; data: Record<string, string> }[]>`
      select tenant_id, id, data from docs
      where collection = ${collection} and upper(data->>'accessCode') = ${scope.code} limit 1`;
    const hit = rows[0];
    if (!hit) return null;
    tenantId = hit.tenant_id;
    if (scope.kind === "order") {
      editableOrders = [hit.id];
      vehicleIds = [hit.data.vehicleId];
      customerIds = [hit.data.customerId];
    } else {
      vehicleIds = [hit.id];
      customerIds = [hit.data.customerId];
    }
    const orders = await sql<{ id: string }[]>`
      select id from docs where tenant_id = ${tenantId} and collection = 'workorders'
        and (data->>'vehicleId' = any(${vehicleIds}) or id = any(${editableOrders}))`;
    orderIds = orders.map((o) => o.id);
  }

  const shared = await sql`
    select tenant_id, collection, id, data from docs
    where (tenant_id = ${GLOBAL_TENANT} and collection = 'plans')
       or (tenant_id = ${GLOBAL_TENANT} and collection = 'tenants' and id = ${tenantId})
       or (tenant_id = ${tenantId} and collection = 'services')`;
  const docs = rowsToDocs(shared);

  if (scope.kind !== "booking") {
    const own = await sql`
      select tenant_id, collection, id, data from docs
      where tenant_id = ${tenantId} and (
           (collection = 'workorders' and id = any(${orderIds}))
        or (collection = 'vehicles' and id = any(${vehicleIds}))
        or (collection = 'customers' and id = any(${customerIds}))
        or (collection in ('invoices', 'reviews') and data->>'workOrderId' = any(${orderIds}))
        or (collection = 'reminders' and data->>'vehicleId' = any(${vehicleIds})))`;
    docs.push(...rowsToDocs(own));
    const staff = await sql`
      select tenant_id, collection, id, data from docs
      where tenant_id = ${GLOBAL_TENANT} and collection = 'users' and data->>'tenantId' = ${tenantId}`;
    docs.push(...rowsToDocs(staff).map((d) => ({ ...d, data: publicUser(d.data) })));
  }

  return { tenantId, orderIds: new Set(editableOrders), docs };
}

// ---- Writing ---------------------------------------------------------------

export interface WriteOp {
  t: string;
  c: string;
  upserts: Record<string, unknown>[];
  deletes: string[];
}

export class AccessError extends Error {}

function deny(message = "No tienes permiso para guardar estos datos."): never {
  throw new AccessError(message);
}

async function existingDoc(t: string, c: string, id: string) {
  const sql = await db();
  const rows = await sql<{ data: Record<string, unknown> }[]>`
    select data from docs where tenant_id = ${t} and collection = ${c} and id = ${id}`;
  return rows[0]?.data ?? null;
}

const SUBSCRIPTION_FIELDS = ["planId", "status", "id"];
const PROTECTED_ORDER_FIELDS = ["id", "tenantId", "customerId", "vehicleId", "accessCode"];

/** Throws AccessError unless `user` (or the guest) may apply `op`. */
export async function checkWrite(op: WriteOp, user: User | null, guest: ResolvedGuest | null) {
  const { t, c } = op;
  for (const doc of op.upserts) {
    if (typeof doc.id !== "string" || !doc.id) deny("Falta el identificador del documento.");
  }

  if (user?.role === "superadmin") {
    if (
      !(TENANT_COLLECTIONS.has(c) && t !== GLOBAL_TENANT) &&
      !(GLOBAL_COLLECTIONS.has(c) && t === GLOBAL_TENANT)
    )
      deny();
    return;
  }

  if (user) {
    const own = user.tenantId;
    if (!own) deny();
    if (TENANT_COLLECTIONS.has(c)) {
      if (t !== own) deny();
      for (const doc of op.upserts) if (doc.tenantId !== undefined && doc.tenantId !== own) deny();
      return;
    }
    if (t !== GLOBAL_TENANT) deny();
    if (c === "tenants") {
      if (op.deletes.length || user.role !== "owner") deny();
      for (const doc of op.upserts) {
        if (doc.id !== own) deny();
        const before = await existingDoc(GLOBAL_TENANT, "tenants", own);
        if (!before) deny();
        for (const f of SUBSCRIPTION_FIELDS)
          if (doc[f] !== before[f])
            deny("Solo el administrador puede cambiar el plan o el estado del taller.");
      }
      return;
    }
    if (c === "users") {
      for (const id of op.deletes) {
        const before = await existingDoc(GLOBAL_TENANT, "users", id);
        if (user.role !== "owner" || !before || before.tenantId !== own || id === user.id) deny();
      }
      for (const doc of op.upserts) {
        const before = await existingDoc(GLOBAL_TENANT, "users", doc.id as string);
        if (doc.tenantId !== own || doc.role === "superadmin") deny();
        if (before && before.tenantId !== own) deny();
        if (user.role !== "owner") {
          // Staff can only edit their own profile, not their role or status
          if (
            doc.id !== user.id ||
            !before ||
            doc.role !== before.role ||
            doc.active !== before.active
          )
            deny();
        }
      }
      return;
    }
    deny();
  }

  if (guest) {
    if (t !== guest.tenantId || op.deletes.length) deny();
    for (const doc of op.upserts) {
      if (c === "workorders") {
        if (!guest.orderIds.has(doc.id as string)) deny();
        const before = await existingDoc(t, c, doc.id as string);
        if (!before) deny();
        for (const f of PROTECTED_ORDER_FIELDS) if (doc[f] !== before[f]) deny();
      } else if (c === "reviews") {
        if (!guest.orderIds.has(doc.workOrderId as string) || doc.tenantId !== t) deny();
        if (await existingDoc(t, c, doc.id as string)) deny();
      } else if (c === "notifications") {
        if (doc.tenantId !== t || (await existingDoc(t, c, doc.id as string))) deny();
      } else {
        deny();
      }
    }
    return;
  }

  deny("Inicia sesión para guardar cambios.");
}

/** Emails and access codes must be unique across the whole platform. */
export async function checkUnique(op: WriteOp) {
  const sql = await db();
  for (const doc of op.upserts) {
    if (op.c === "users" && typeof doc.email === "string") {
      const clash = await sql`
        select 1 from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'users'
          and lower(data->>'email') = lower(${doc.email.trim()}) and id <> ${doc.id as string}`;
      if (clash.length) throw new AccessError(`Ya existe un usuario con el email ${doc.email}.`);
    }
    if (
      (op.c === "workorders" || op.c === "vehicles") &&
      typeof doc.accessCode === "string" &&
      doc.accessCode
    ) {
      const clash = await sql`
        select 1 from docs where collection = ${op.c} and upper(data->>'accessCode') = upper(${doc.accessCode})
          and not (tenant_id = ${op.t} and id = ${doc.id as string})`;
      if (clash.length) throw new AccessError("Código de acceso duplicado. Vuelve a intentarlo.");
    }
    if (op.c === "tenants" && typeof doc.slug === "string") {
      const clash = await sql`
        select 1 from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'tenants'
          and lower(data->>'slug') = lower(${doc.slug}) and id <> ${doc.id as string}`;
      if (clash.length) throw new AccessError(`La dirección /t/${doc.slug} ya la usa otro taller.`);
    }
  }
}
