// Garage — superadmin actions that touch a whole workshop at once.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Deletes a workshop for good: its data, its users (and their logins), its
 * photos, and stops its Stripe subscription. Only the superadmin (not in
 * support mode), and only after typing the workshop's exact name.
 */
export const deleteTenant = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ tenantId: z.string().min(1).max(100), confirmName: z.string().max(200) }),
  )
  .handler(async ({ data }) => {
    const { currentSession } = await import("@/lib/server/auth.server");
    const { db, GLOBAL_TENANT } = await import("@/lib/server/db.server");
    const { cancelSubscriptionNow, getTenant } = await import("@/lib/server/stripe.server");
    const { deleteTenantFiles } = await import("@/lib/server/files.server");

    const session = await currentSession();
    if (!session || session.user.role !== "superadmin" || session.impersonatorId) {
      return { ok: false as const, error: "Solo el superadmin puede eliminar talleres." };
    }
    if (data.tenantId === GLOBAL_TENANT) return { ok: false as const, error: "Taller no válido." };
    const tenant = await getTenant(data.tenantId);
    if (!tenant) return { ok: false as const, error: "Taller no encontrado." };
    if (data.confirmName.trim() !== tenant.name.trim()) {
      return { ok: false as const, error: "El nombre no coincide." };
    }

    try {
      await cancelSubscriptionNow(tenant);
    } catch (err) {
      return {
        ok: false as const,
        error: `No se pudo cancelar la suscripción en Stripe (${(err as Error).message}). No se ha borrado nada.`,
      };
    }

    const sql = await db();
    await sql.begin(async (tx) => {
      const users = await tx<{ id: string }[]>`
        select id from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'users'
          and data->>'tenantId' = ${tenant.id}`;
      const ids = users.map((u) => u.id);
      if (ids.length) {
        await tx`delete from sessions where user_id = any(${ids}) or impersonator_id = any(${ids})`;
        await tx`delete from credentials where user_id = any(${ids})`;
        await tx`delete from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'users' and id = any(${ids})`;
      }
      await tx`delete from docs where tenant_id = ${tenant.id}`;
      await tx`delete from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'tenants' and id = ${tenant.id}`;
    });
    await deleteTenantFiles(tenant.id);
    return { ok: true as const, error: null };
  });
