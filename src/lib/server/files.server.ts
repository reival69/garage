// Garage — photos, signatures and logos stored as files (server only).
//
// The app creates images as base64 "data:" URLs (that is how it kept them in
// localStorage). When a document is saved, every embedded image is written to
// disk and replaced by a short URL, so documents stay small and there is no
// 5 MB browser limit. File names are long random tokens: knowing the URL is
// what grants access, the same way the order access codes work.
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const FILES_PREFIX = "/files/";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};
const CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(TYPES).map(([type, ext]) => [ext, type]),
);

function uploadDir() {
  return process.env.UPLOAD_DIR ?? path.resolve(".data/uploads");
}

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i;

async function storeDataUrl(tenantId: string, value: string): Promise<string> {
  const match = DATA_URL.exec(value);
  if (!match) return value;
  const ext = TYPES[match[1].toLowerCase()];
  if (!ext) return value;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Una imagen supera el tamaño máximo (8 MB).");
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const name = `${randomBytes(18).toString("base64url")}.${ext}`;
  const dir = path.join(uploadDir(), safeTenant);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `${FILES_PREFIX}${safeTenant}/${name}`;
}

/** Returns a copy of `value` with every embedded image moved to disk. */
export async function extractImages<T>(tenantId: string, value: T): Promise<T> {
  if (typeof value === "string") {
    return (value.startsWith("data:image/") ? await storeDataUrl(tenantId, value) : value) as T;
  }
  if (Array.isArray(value)) {
    return (await Promise.all(value.map((v) => extractImages(tenantId, v)))) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await extractImages(tenantId, v);
    return out as T;
  }
  return value;
}

/** Serves /files/<tenant>/<name>; returns null when the path is not a stored file. */
export async function serveFile(pathname: string): Promise<Response | null> {
  const match = /^\/files\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+\.([a-z]+))$/.exec(pathname);
  if (!match) return null;
  const type = CONTENT_TYPES[match[3]];
  if (!type) return null;
  try {
    const body = await readFile(path.join(uploadDir(), match[1], match[2]));
    return new Response(body, {
      headers: {
        "content-type": type,
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        // SVGs could carry scripts: never let them run as a page
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return null;
  }
}

/** Deletes every photo, signature and logo of a workshop. */
export async function deleteTenantFiles(tenantId: string) {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safeTenant || safeTenant === "." || safeTenant === "..") return;
  await rm(path.join(uploadDir(), safeTenant), { recursive: true, force: true });
}
