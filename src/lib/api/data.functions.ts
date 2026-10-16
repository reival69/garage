// Garage — the browser's only door to the database.
//
// The client keeps working with synchronous repositories (src/lib/db); this file
// loads what the current visitor may see and saves their changes. All checks
// (who can read or write what) happen on the server, in src/lib/server.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Appointment, Customer, Tenant, User, Vehicle } from "@/types";

const docSchema = z.record(z.string(), z.unknown());

// Documents are plain JSON; `any` lets them through the server-function
// serialization check, which cannot prove `unknown` is serializable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocData = Record<string, any>;
type DocOut = { t: string; c: string; id: string; data: DocData };
const opSchema = z.object({
  t: z.string().min(1).max(100),
  c: z.string().min(1).max(40),
  upserts: z.array(docSchema).max(500),
  deletes: z.array(z.string().max(200)).max(500),
});

export interface BootstrapResult {
  user: User | null;
  impersonating: boolean;
  docs: DocOut[];
  /** True when the customer/booking page in `path` exists. */
  guestFound: boolean;
}

/** Loads everything the current session (and the customer/booking page in `path`) may see. */
export const bootstrap = createServerFn({ method: "POST" })
  .inputValidator(z.object({ path: z.string().max(300) }))
  .handler(async ({ data }): Promise<BootstrapResult> => {
    const { currentSession, clientIp, rateLimit } = await import("@/lib/server/auth.server");
    const { blockedTenant, docsForGuest, docsForUser, guestScopeFromPath } =
      await import("@/lib/server/access.server");

    const session = await currentSession();
    let docs = session ? await docsForUser(session.user) : [];
    if (session && (await blockedTenant(session.user, !!session.impersonatorId))) {
      // Subscription not active: only what the payment screen needs
      docs = docs.filter((d) => d.t === "global");
    }
    let guestFound = false;
    const scope = guestScopeFromPath(data.path);
    if (scope) {
      // Codes are short: limit how fast anyone can try them
      if (scope.kind !== "booking") rateLimit(`code:${clientIp()}`, 60, 10 * 60_000);
      const guest = await docsForGuest(scope);
      if (guest) {
        guestFound = true;
        const seen = new Set(docs.map((d) => `${d.t}|${d.c}|${d.id}`));
        for (const d of guest.docs) if (!seen.has(`${d.t}|${d.c}|${d.id}`)) docs.push(d);
      }
    }
    return {
      user: session?.user ?? null,
      impersonating: !!session?.impersonatorId,
      docs,
      guestFound,
    };
  });

/** Saves changes made in the browser. Returns the saved documents (images become /files URLs). */
export const syncDocs = createServerFn({ method: "POST" })
  .inputValidator(z.object({ path: z.string().max(300), ops: z.array(opSchema).max(50) }))
  .handler(async ({ data }) => {
    const { currentSession } = await import("@/lib/server/auth.server");
    const { AccessError, blockedTenant, checkUnique, checkWrite, docsForGuest, guestScopeFromPath } =
      await import("@/lib/server/access.server");
    const { db } = await import("@/lib/server/db.server");
    const { extractImages } = await import("@/lib/server/files.server");

    const session = await currentSession();
    const scope = session ? null : guestScopeFromPath(data.path);
    const guest = scope && scope.kind !== "booking" ? await docsForGuest(scope) : null;

    if (session && (await blockedTenant(session.user, !!session.impersonatorId))) {
      return {
        ok: false as const,
        error: "La suscripción del taller no está activa. Actívala en «Suscripción» para seguir trabajando.",
        saved: [] as DocOut[],
      };
    }

    try {
      for (const op of data.ops) {
        await checkWrite(op, session?.user ?? null, guest);
        await checkUnique(op);
      }
    } catch (err) {
      if (err instanceof AccessError)
        return { ok: false as const, error: err.message, saved: [] as DocOut[] };
      throw err;
    }

    const sql = await db();
    const saved: DocOut[] = [];
    for (const op of data.ops) {
      for (const raw of op.upserts) {
        const doc = await extractImages(op.t, raw);
        const id = doc.id as string;
        await sql`
          insert into docs (tenant_id, collection, id, data) values (${op.t}, ${op.c}, ${id}, ${sql.json(doc as never)})
          on conflict (tenant_id, collection, id) do update set data = excluded.data, updated_at = now()`;
        saved.push({ t: op.t, c: op.c, id, data: doc });
      }
      if (op.deletes.length) {
        await sql`delete from docs where tenant_id = ${op.t} and collection = ${op.c} and id = any(${op.deletes})`;
        if (op.c === "users") {
          await sql`delete from credentials where user_id = any(${op.deletes})`;
          await sql`delete from sessions where user_id = any(${op.deletes})`;
        }
      }
    }
    return { ok: true as const, error: null, saved };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }),
  )
  .handler(async ({ data }) => {
    const { checkCredentials, clientIp, rateLimit, startSession } =
      await import("@/lib/server/auth.server");
    try {
      rateLimit(`login:${clientIp()}`, 20, 15 * 60_000);
      rateLimit(`login:${data.email.toLowerCase()}`, 8, 15 * 60_000);
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
    const user = await checkCredentials(data.email, data.password);
    if (!user) return { ok: false as const, error: "Email o contraseña incorrectos." };
    await startSession(user.id);
    return { ok: true as const, error: null, role: user.role };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("@/lib/server/auth.server");
  await endSession();
  return { ok: true };
});

/**
 * Sets a password. Allowed for: the user themselves (with their current password),
 * the owner of the same workshop, and the superadmin.
 */
export const setPassword = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().min(1),
      password: z.string().max(200),
      currentPassword: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { checkCredentials, currentSession, getUserById, setUserPassword, startSession } =
      await import("@/lib/server/auth.server");
    const session = await currentSession();
    if (!session) return { ok: false as const, error: "Inicia sesión." };
    const target = await getUserById(data.userId);
    if (!target) return { ok: false as const, error: "Usuario no encontrado." };
    const me = session.user;
    const self = me.id === target.id;
    const allowed =
      me.role === "superadmin" ||
      (me.role === "owner" && target.tenantId === me.tenantId && target.role !== "superadmin") ||
      self;
    if (!allowed)
      return { ok: false as const, error: "No tienes permiso para cambiar esta contraseña." };
    if (self && !session.impersonatorId) {
      if (!data.currentPassword || !(await checkCredentials(me.email, data.currentPassword))) {
        return { ok: false as const, error: "La contraseña actual no es correcta." };
      }
    }
    try {
      await setUserPassword(target.id, data.password);
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
    if (self) await startSession(me.id, session.impersonatorId);
    return { ok: true as const, error: null };
  });

/** Superadmin support: open a workshop as its owner, and come back. */
export const impersonate = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { currentSession, endSession, getUserById, startSession } =
      await import("@/lib/server/auth.server");
    const session = await currentSession();
    if (!session || session.user.role !== "superadmin")
      return { ok: false as const, error: "Solo el superadmin." };
    const target = await getUserById(data.userId);
    if (!target || target.role === "superadmin")
      return { ok: false as const, error: "Usuario no válido." };
    await endSession();
    await startSession(target.id, session.user.id);
    return { ok: true as const, error: null };
  });

export const stopImpersonating = createServerFn({ method: "POST" }).handler(async () => {
  const { currentSession, endSession, startSession } = await import("@/lib/server/auth.server");
  const session = await currentSession();
  if (!session?.impersonatorId) return { ok: false as const };
  const adminId = session.impersonatorId;
  await endSession();
  await startSession(adminId);
  return { ok: true as const };
});

const bookingSchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  plate: z.string().trim().max(20).optional(),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  serviceIds: z.array(z.string().max(100)).max(20),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  notes: z.string().trim().max(1000).optional(),
});

function code6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

/**
 * Public booking (/t/:slug). Runs on the server because it matches the visitor
 * against the workshop's existing customers and vehicles, which a visitor must
 * never be able to read.
 */
export const bookOnline = createServerFn({ method: "POST" })
  .inputValidator(bookingSchema)
  .handler(async ({ data }) => {
    const { clientIp, rateLimit } = await import("@/lib/server/auth.server");
    const { db, GLOBAL_TENANT } = await import("@/lib/server/db.server");
    try {
      rateLimit(`booking:${clientIp()}`, 10, 60 * 60_000);
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
    if (new Date(data.scheduledAt).getTime() < Date.now() - 60_000) {
      return { ok: false as const, error: "Elige una fecha futura." };
    }
    const sql = await db();
    const tenants = await sql<{ data: Tenant }[]>`
      select data from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'tenants'
        and lower(data->>'slug') = lower(${data.slug}) and data->>'status' = 'active'`;
    const tenant = tenants[0]?.data;
    if (!tenant) return { ok: false as const, error: "Taller no encontrado." };
    const t = tenant.id;
    const newId = (prefix: string) =>
      `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const save = (c: string, doc: { id: string }) =>
      sql`insert into docs (tenant_id, collection, id, data) values (${t}, ${c}, ${doc.id}, ${sql.json(doc as never)})`;

    const phoneKey = data.phone.replace(/\s+/g, "");
    const existing = await sql<{ data: Customer }[]>`
      select data from docs where tenant_id = ${t} and collection = 'customers'
        and regexp_replace(data->>'phone', '\\s+', '', 'g') = ${phoneKey} limit 1`;
    let customer = existing[0]?.data;
    if (!customer) {
      customer = {
        id: newId("customers"),
        tenantId: t,
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        createdAt: new Date().toISOString(),
      };
      await save("customers", customer);
    }

    let vehicleId: string | undefined;
    const plate = data.plate?.replace(/\s+/g, "").toUpperCase();
    if (plate) {
      const found = await sql<{ id: string }[]>`
        select id from docs where tenant_id = ${t} and collection = 'vehicles'
          and upper(regexp_replace(data->>'plate', '\\s+', '', 'g')) = ${plate} limit 1`;
      if (found[0]) {
        vehicleId = found[0].id;
      } else {
        let accessCode = code6();
        for (let i = 0; i < 20; i++) {
          const clash =
            await sql`select 1 from docs where collection = 'vehicles' and upper(data->>'accessCode') = ${accessCode}`;
          if (!clash.length) break;
          accessCode = code6();
        }
        const vehicle: Vehicle = {
          id: newId("vehicles"),
          tenantId: t,
          customerId: customer.id,
          accessCode,
          plate,
          make: data.make || "—",
          model: data.model || "—",
          year: new Date().getFullYear(),
          km: 0,
        } as Vehicle;
        await save("vehicles", vehicle);
        vehicleId = vehicle.id;
      }
    }

    const appt = {
      id: newId("appointments"),
      tenantId: t,
      locationId: tenant.locations?.[0]?.id ?? "",
      customerId: customer.id,
      vehicleId,
      serviceIds: data.serviceIds,
      scheduledAt: data.scheduledAt,
      status: "programada",
      source: "online",
      notes: data.notes || undefined,
    } as Appointment;
    await save("appointments", appt);

    const when = new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Madrid",
    }).format(new Date(data.scheduledAt));
    await save("notifications", {
      id: newId("notifications"),
      tenantId: t,
      type: "cita",
      title: "Nueva cita online",
      body: `${data.name} — ${plate ?? "sin vehículo"} · ${when}`,
      link: "/app/citas",
      read: false,
      createdAt: new Date().toISOString(),
    } as { id: string });

    return { ok: true as const, error: null, appointment: appt };
  });
