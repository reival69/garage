#!/usr/bin/env node
// Garage — create the superadmin, or reset its password.
//
// Run it on the server, from /opt/garage:
//   sudo bash deploy/create-superadmin.sh tu@email.com "Tu nombre"
// (the .sh wrapper loads DATABASE_URL from /etc/garage.env).
//
// The password is asked twice and never shown. It is stored with the same
// format the app uses (scrypt$salt$key).
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { stdin, stdout } from "node:process";
import { promisify } from "node:util";
import postgres from "postgres";

const scrypt = promisify(scryptCb);
const MIN_PASSWORD_LENGTH = 10;

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim() || "Superadmin";
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: create-superadmin.mjs tu@email.com "Tu nombre"');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (está en /etc/garage.env).");
  process.exit(1);
}

/** Reads a line without echoing it (also works with piped input). */
let buffered = "";
function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    const tty = stdin.isTTY;
    const finish = () => {
      if (tty) stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdin.off("end", finish);
      stdout.write("\n");
      resolve(value);
    };
    const onData = (chunk) => {
      buffered += chunk;
      while (buffered) {
        const ch = buffered[0];
        buffered = buffered.slice(1);
        if (ch === "\n" || ch === "\r" || ch === "\u0004") return finish();
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    if (tty) stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
    stdin.on("end", finish);
    if (buffered) onData("");
    stdin.resume();
  });
}

const password = await askHidden("Contraseña nueva (mínimo 10 caracteres): ");
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error("La contraseña es demasiado corta.");
  process.exit(1);
}
if ((await askHidden("Repite la contraseña: ")) !== password) {
  console.error("Las contraseñas no coinciden.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const hash = `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  // Same tables the app creates on its first request
  await sql.unsafe(`
    create table if not exists docs (
      tenant_id text not null, collection text not null, id text not null,
      data jsonb not null, updated_at timestamptz not null default now(),
      primary key (tenant_id, collection, id));
    create table if not exists credentials (
      user_id text primary key, password_hash text not null,
      updated_at timestamptz not null default now());
    create table if not exists sessions (
      token_hash text primary key, user_id text not null, impersonator_id text,
      created_at timestamptz not null default now(), expires_at timestamptz not null);
  `);

  const existing = await sql`
    select id, data from docs
    where tenant_id = 'global' and collection = 'users' and lower(data->>'email') = lower(${email})`;
  let userId;
  if (existing[0]) {
    if (existing[0].data.role !== "superadmin") {
      console.error(`${email} ya es usuario de un taller. Usa otro email para el superadmin.`);
      process.exit(1);
    }
    userId = existing[0].id;
    console.log(`El superadmin ${email} ya existe: cambio su contraseña.`);
  } else {
    userId = `usr_${randomBytes(8).toString("hex")}`;
    const user = { id: userId, tenantId: null, name, email: email.toLowerCase(), role: "superadmin", active: true };
    await sql`insert into docs (tenant_id, collection, id, data) values ('global', 'users', ${userId}, ${sql.json(user)})`;
    console.log(`Superadmin creado: ${email}`);
  }
  await sql`
    insert into credentials (user_id, password_hash) values (${userId}, ${hash})
    on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`;
  await sql`delete from sessions where user_id = ${userId}`;
  console.log("Listo. Entra en /login con ese email y contraseña.");
} finally {
  await sql.end();
}
