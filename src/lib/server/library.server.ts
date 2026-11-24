// Garage — Biblioteca técnica on the server: PDF storage, viewing and search.
//
// The document metadata (title, vehicle tags…) is a normal `library` document
// synced through syncDocs. The heavy parts live on disk, next to the photos:
//   {UPLOAD_DIR}/{tenant}/library/{docId}.pdf         the original PDF
//   {UPLOAD_DIR}/{tenant}/library/{docId}.pages.json  extracted text per page
// The text is extracted in the browser (pdf.js) and uploaded with the file.
//
// Unlike photos (/files/…, where knowing the URL is enough), manuals are often
// copyrighted: every request needs a signed-in user of that same workshop.
//
// Routes (dispatched from src/server.ts):
//   POST /api/library/upload        multipart: id, file, pages (JSON string[])
//   GET  /api/library/file/{id}     the PDF, inline
//   POST /api/library/search        JSON: { query, ids, limit }
//   POST /api/library/delete        JSON: { id }
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { User } from "@/types";
import { searchPages, type DocPages } from "@/lib/library-search";
import { uploadDir } from "./files.server";

export const MAX_PDF_BYTES = 60 * 1024 * 1024;
const MAX_TEXT_CHARS = 30 * 1024 * 1024;
const MAX_PAGES = 5000;
const ID = /^[A-Za-z0-9_-]{1,80}$/;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function libraryDir(tenantId: string) {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safeTenant || safeTenant === "." || safeTenant === "..") throw new HttpError(403, "Sin acceso.");
  return path.join(uploadDir(), safeTenant, "library");
}

function checkId(id: unknown): string {
  if (typeof id !== "string" || !ID.test(id)) throw new HttpError(400, "Documento no válido.");
  return id;
}

/** Signed-in workshop user allowed to use the Biblioteca. */
async function requireUser(request: Request): Promise<User & { tenantId: string }> {
  const { sessionFromRequest } = await import("./auth.server");
  const { blockedTenant } = await import("./access.server");
  const { can } = await import("@/lib/permissions");
  const session = await sessionFromRequest(request);
  if (!session) throw new HttpError(401, "Inicia sesión para usar la biblioteca.");
  const { user } = session;
  if (!user.tenantId || !can(user.role, "biblioteca")) throw new HttpError(403, "Sin acceso.");
  if (await blockedTenant(user, !!session.impersonatorId)) {
    throw new HttpError(402, "La suscripción del taller no está activa.");
  }
  return user as User & { tenantId: string };
}

// Page text is read often while searching: keep the most recent ones in memory.
const pagesCache = new Map<string, string[]>();
const CACHE_ENTRIES = 40;

async function loadPages(tenantId: string, id: string): Promise<string[]> {
  const key = `${tenantId}:${id}`;
  const hit = pagesCache.get(key);
  if (hit) {
    pagesCache.delete(key);
    pagesCache.set(key, hit);
    return hit;
  }
  let pages: string[] = [];
  try {
    const raw = await readFile(path.join(libraryDir(tenantId), `${id}.pages.json`), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) pages = parsed.map((p) => (typeof p === "string" ? p : ""));
  } catch {
    return [];
  }
  pagesCache.set(key, pages);
  if (pagesCache.size > CACHE_ENTRIES) pagesCache.delete(pagesCache.keys().next().value!);
  return pages;
}

async function upload(request: Request, user: User & { tenantId: string }) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_PDF_BYTES + MAX_TEXT_CHARS * 2) {
    throw new HttpError(413, "El PDF es demasiado grande (máximo 60 MB).");
  }
  const form = await request.formData();
  const id = checkId(form.get("id"));
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new HttpError(400, "Falta el archivo PDF.");
  if (file.size > MAX_PDF_BYTES) throw new HttpError(413, "El PDF supera el máximo de 60 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new HttpError(400, "El archivo no es un PDF.");
  }

  let pages: string[];
  try {
    const parsed: unknown = JSON.parse(String(form.get("pages") ?? "[]"));
    if (!Array.isArray(parsed) || parsed.length > MAX_PAGES) throw new Error();
    pages = parsed.map((p) => (typeof p === "string" ? p : ""));
  } catch {
    throw new HttpError(400, "El texto del PDF no es válido.");
  }
  if (pages.reduce((n, p) => n + p.length, 0) > MAX_TEXT_CHARS) {
    throw new HttpError(413, "El PDF tiene demasiado texto.");
  }

  const dir = libraryDir(user.tenantId);
  await mkdir(dir, { recursive: true });
  // Never overwrite: ids are random, a clash means someone is replaying a request
  const pdfPath = path.join(dir, `${id}.pdf`);
  if (await stat(pdfPath).then(() => true, () => false)) {
    throw new HttpError(409, "Ese documento ya existe.");
  }
  await writeFile(path.join(dir, `${id}.pages.json`), JSON.stringify(pages));
  await writeFile(pdfPath, bytes);
  pagesCache.set(`${user.tenantId}:${id}`, pages);
  return json({ ok: true, pageCount: pages.length });
}

async function serveFile(user: User & { tenantId: string }, id: string) {
  let body: Buffer;
  try {
    body = await readFile(path.join(libraryDir(user.tenantId), `${id}.pdf`));
  } catch {
    return new Response("Documento no encontrado", { status: 404 });
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${id}.pdf"`,
      // Not cached: a deleted manual (or a signed-out user) must not reopen it from cache
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function search(request: Request, user: User & { tenantId: string }) {
  const body = (await request.json().catch(() => null)) as {
    query?: unknown;
    ids?: unknown;
    limit?: unknown;
  } | null;
  const query = typeof body?.query === "string" ? body.query.slice(0, 300) : "";
  const ids = Array.isArray(body?.ids) ? body.ids.slice(0, 500).map(checkId) : [];
  const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 30);
  const docs: DocPages[] = [];
  for (const id of ids) docs.push({ docId: id, pages: await loadPages(user.tenantId, id) });
  return json({ hits: searchPages(docs, query, limit) });
}

async function remove(request: Request, user: User & { tenantId: string }) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = checkId(body?.id);
  const dir = libraryDir(user.tenantId);
  await rm(path.join(dir, `${id}.pdf`), { force: true });
  await rm(path.join(dir, `${id}.pages.json`), { force: true });
  pagesCache.delete(`${user.tenantId}:${id}`);
  return json({ ok: true });
}

/** Handles /api/library/*; returns null for any other path. */
export async function handleLibraryRequest(request: Request, pathname: string) {
  if (!pathname.startsWith("/api/library/")) return null;
  try {
    const user = await requireUser(request);
    const fileMatch = /^\/api\/library\/file\/([A-Za-z0-9_-]{1,80})$/.exec(pathname);
    if (fileMatch && (request.method === "GET" || request.method === "HEAD")) {
      return await serveFile(user, fileMatch[1]);
    }
    if (request.method === "POST") {
      if (pathname === "/api/library/upload") return await upload(request, user);
      if (pathname === "/api/library/search") return await search(request, user);
      if (pathname === "/api/library/delete") return await remove(request, user);
    }
    return json({ error: "No encontrado" }, 404);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("Biblioteca:", err);
    return json({ error: "Error en el servidor." }, 500);
  }
}
