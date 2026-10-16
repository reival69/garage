// Garage — PostgreSQL access (server only).
//
// Domain data keeps the same shape it had in localStorage: one JSON document per
// entity, grouped by tenant and collection. The browser still works with plain
// arrays through src/lib/db; this module is where those documents really live.
import process from "node:process";
import postgres from "postgres";

export const GLOBAL_TENANT = "global";

export interface DocRow {
  t: string; // tenant id, or "global"
  c: string; // collection
  id: string;
  data: Record<string, unknown>;
}

let client: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

function connect() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no está configurada");
    client = postgres(url, { max: 10, idle_timeout: 30, onnotice: () => {} });
  }
  return client;
}

/** Database client with the schema guaranteed to exist. */
export async function db() {
  const sql = connect();
  schemaReady ??= ensureSchema(sql).catch((err) => {
    schemaReady = null;
    throw err;
  });
  await schemaReady;
  return sql;
}

async function ensureSchema(sql: ReturnType<typeof postgres>) {
  await sql.unsafe(`
    create table if not exists docs (
      tenant_id  text not null,
      collection text not null,
      id         text not null,
      data       jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (tenant_id, collection, id)
    );
    create index if not exists docs_access_code_idx
      on docs (collection, (upper(data->>'accessCode')))
      where collection in ('workorders', 'vehicles');
    create index if not exists docs_user_email_idx
      on docs ((lower(data->>'email')))
      where tenant_id = 'global' and collection = 'users';

    create table if not exists credentials (
      user_id       text primary key,
      password_hash text not null,
      updated_at    timestamptz not null default now()
    );

    create table if not exists sessions (
      token_hash      text primary key,
      user_id         text not null,
      impersonator_id text,
      created_at      timestamptz not null default now(),
      expires_at      timestamptz not null
    );
    create index if not exists sessions_user_idx on sessions (user_id);
  `);

  // A new installation starts with the three subscription plans
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'plans'`;
  if (count === 0) {
    const { PLANS } = await import("@/lib/db/seed");
    for (const plan of PLANS) {
      await sql`
        insert into docs (tenant_id, collection, id, data)
        values (${GLOBAL_TENANT}, 'plans', ${plan.id}, ${sql.json(plan as never)})
        on conflict do nothing`;
    }
  }
}

/** Rows selected as (tenant_id, collection, id, data) → documents. */
export function rowsToDocs(rows: readonly Record<string, unknown>[]): DocRow[] {
  return rows.map((r) => ({
    t: r.tenant_id as string,
    c: r.collection as string,
    id: r.id as string,
    data: r.data as Record<string, unknown>,
  }));
}
