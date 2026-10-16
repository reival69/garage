// Garage — passwords and sessions (server only).
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestUrl,
  setCookie,
} from "@tanstack/react-start/server";
import type { User } from "@/types";
import { db, GLOBAL_TENANT } from "./db.server";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const COOKIE = "garage_session";
const SESSION_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 10;

// ---- Passwords -------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Same work as a real check, so unknown emails can't be told apart by timing. */
const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function setUserPassword(userId: string, password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  const sql = await db();
  const hash = await hashPassword(password);
  await sql`
    insert into credentials (user_id, password_hash) values (${userId}, ${hash})
    on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`;
  // Changing a password signs out every other device of that user
  await sql`delete from sessions where user_id = ${userId}`;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const sql = await db();
  const rows = await sql<{ data: User }[]>`
    select data from docs
    where tenant_id = ${GLOBAL_TENANT} and collection = 'users' and lower(data->>'email') = lower(${email.trim()})
    limit 1`;
  return rows[0]?.data ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const sql = await db();
  const rows = await sql<{ data: User }[]>`
    select data from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'users' and id = ${id}`;
  return rows[0]?.data ?? null;
}

/** Checks email + password; returns the user only when both match and the account is usable. */
export async function checkCredentials(email: string, password: string): Promise<User | null> {
  const sql = await db();
  const user = await findUserByEmail(email);
  const rows = user
    ? await sql<
        { password_hash: string }[]
      >`select password_hash from credentials where user_id = ${user.id}`
    : [];
  const ok = await verifyPassword(password, rows[0]?.password_hash ?? DUMMY_HASH);
  if (!ok || !user || user.active === false) return null;
  if (user.tenantId) {
    const tenant = await sql<{ status: string }[]>`
      select data->>'status' as status from docs where tenant_id = ${GLOBAL_TENANT} and collection = 'tenants' and id = ${user.tenantId}`;
    if (tenant[0]?.status === "suspended") return null;
  }
  return user;
}

// ---- Sessions --------------------------------------------------------------

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isHttps() {
  const proto = getRequestHeader("x-forwarded-proto");
  return proto ? proto.split(",")[0].trim() === "https" : getRequestUrl().protocol === "https:";
}

export async function startSession(
  userId: string,
  impersonatorId: string | null = null,
): Promise<void> {
  const sql = await db();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sql`
    insert into sessions (token_hash, user_id, impersonator_id, expires_at)
    values (${tokenHash(token)}, ${userId}, ${impersonatorId}, ${expires})`;
  await sql`delete from sessions where expires_at < now()`;
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(),
    path: "/",
    expires,
  });
}

export interface CurrentSession {
  user: User;
  impersonatorId: string | null;
}

export async function currentSession(): Promise<CurrentSession | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const sql = await db();
  const rows = await sql<{ user_id: string; impersonator_id: string | null }[]>`
    select user_id, impersonator_id from sessions where token_hash = ${tokenHash(token)} and expires_at > now()`;
  if (!rows[0]) return null;
  const user = await getUserById(rows[0].user_id);
  if (!user || user.active === false) return null;
  return { user, impersonatorId: rows[0].impersonator_id };
}

export async function endSession(): Promise<void> {
  const token = getCookie(COOKIE);
  if (token) {
    const sql = await db();
    await sql`delete from sessions where token_hash = ${tokenHash(token)}`;
  }
  deleteCookie(COOKIE, { path: "/" });
}

// ---- Brute-force protection ------------------------------------------------

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Allows `limit` attempts per key every `windowMs`; throws when exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    if (attempts.size > 10_000) {
      for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
    }
    return;
  }
  entry.count++;
  if (entry.count > limit)
    throw new Error("Demasiados intentos. Espera unos minutos y vuelve a probar.");
}

export function clientIp(): string {
  return (
    getRequestHeader("x-real-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0] ??
    "local"
  ).trim();
}
