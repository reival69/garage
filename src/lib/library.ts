// Garage — Biblioteca técnica (browser side). Each shop uploads its own PDFs
// (manuals it has licensed, technical bulletins, wiring diagrams, notes).
//
// - Text is extracted page by page IN THE BROWSER with pdf.js, then the PDF and
//   its page text are uploaded to the server (src/lib/server/library.server.ts).
// - Metadata (title, vehicle tags…) is a normal `library` document saved
//   through the repos, like any other entity.
// - Search runs on the server; results cite document + page and open the PDF
//   there. Every library request needs a signed-in user of the workshop.

import type { LibraryCategory, LibraryDocument, Vehicle } from "@/types";
import { libraryRepo, uid } from "@/lib/db";
import { fold, type PageHit, type SnippetSegment } from "@/lib/library-search";

export type { SnippetSegment };

export const MAX_PDF_BYTES = 60 * 1024 * 1024; // 60 MB per file (same limit on the server)

export const LIBRARY_CATEGORY_LABELS: Record<LibraryCategory, string> = {
  manual_taller: "Manual de taller",
  boletin: "Boletín técnico",
  esquema: "Esquema eléctrico",
  manual_propietario: "Manual del propietario",
  notas: "Notas del taller",
  otro: "Otro",
};

export const LIBRARY_CATEGORIES = (
  Object.keys(LIBRARY_CATEGORY_LABELS) as LibraryCategory[]
).map((value) => ({ value, label: LIBRARY_CATEGORY_LABELS[value] }));

// ---- PDF text extraction (browser only) -------------------------------------

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

/** Extract the text of every page. `onProgress(done, total)` per page. */
export async function extractPdfPages(
  file: Blob,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      pages.push(text.replace(/[ \t]+/g, " ").trim());
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
  } finally {
    await pdf.destroy();
  }
  return pages;
}

// ---- Server calls --------------------------------------------------------------

async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Error ${res.status}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

/** Upload with progress (fetch has no upload progress events). */
function uploadForm(form: FormData, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/library/upload");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Error ${xhr.status}`;
      try {
        msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg;
      } catch {
        if (xhr.status === 413) msg = "El PDF es demasiado grande para el servidor.";
      }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("No hay conexión con el servidor."));
    xhr.send(form);
  });
}

// ---- CRUD --------------------------------------------------------------------

export interface LibraryUploadMeta {
  title: string;
  category: LibraryCategory;
  make?: string;
  model?: string;
  engine?: string;
  yearFrom?: number;
  yearTo?: number;
}

export type UploadProgress =
  | { stage: "read"; done: number; total: number }
  | { stage: "upload"; fraction: number };

export function listLibrary(tenantId: string): LibraryDocument[] {
  return libraryRepo
    .list(tenantId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function addLibraryDocument(
  tenantId: string,
  file: File,
  meta: LibraryUploadMeta,
  uploadedBy: string | undefined,
  onProgress?: (p: UploadProgress) => void,
): Promise<LibraryDocument> {
  if (file.type && file.type !== "application/pdf") {
    throw new Error("Solo se admiten archivos PDF.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("El PDF supera el máximo de 60 MB.");
  }
  const pages = await extractPdfPages(file, (done, total) =>
    onProgress?.({ stage: "read", done, total }),
  );
  const id = uid("lib");
  const form = new FormData();
  form.append("id", id);
  form.append("file", file, file.name);
  form.append("pages", JSON.stringify(pages));
  // Upload first: the document only appears once its file is on the server.
  await uploadForm(form, (fraction) => onProgress?.({ stage: "upload", fraction }));
  return libraryRepo.create(tenantId, {
    id,
    tenantId,
    title: meta.title.trim() || file.name.replace(/\.pdf$/i, ""),
    category: meta.category,
    fileName: file.name,
    sizeBytes: file.size,
    pageCount: pages.length,
    textPages: pages.filter((p) => p.length > 20).length,
    make: meta.make?.trim() || undefined,
    model: meta.model?.trim() || undefined,
    engine: meta.engine?.trim() || undefined,
    yearFrom: meta.yearFrom || undefined,
    yearTo: meta.yearTo || undefined,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  });
}

export function updateLibraryDocument(
  tenantId: string,
  id: string,
  patch: Partial<LibraryUploadMeta>,
): LibraryDocument | undefined {
  return libraryRepo.update(tenantId, id, {
    ...patch,
    title: patch.title?.trim() || undefined,
    make: patch.make?.trim() || undefined,
    model: patch.model?.trim() || undefined,
    engine: patch.engine?.trim() || undefined,
    yearFrom: patch.yearFrom || undefined,
    yearTo: patch.yearTo || undefined,
  } as Partial<LibraryDocument>);
}

export async function removeLibraryDocument(tenantId: string, id: string): Promise<void> {
  libraryRepo.remove(tenantId, id);
  await postJson("/api/library/delete", { id });
}

/** Open the PDF in a new tab, at the given page (browser PDF viewers honor #page). */
export function openLibraryDocument(id: string, page?: number): void {
  window.open(`/api/library/file/${encodeURIComponent(id)}${page ? `#page=${page}` : ""}`, "_blank", "noopener");
}

// ---- Search ------------------------------------------------------------------

export interface LibraryHit extends Omit<PageHit, "docId"> {
  doc: LibraryDocument;
}

/** Server-side keyword search across the given documents. */
export async function searchLibrary(
  docs: LibraryDocument[],
  query: string,
  limit = 10,
): Promise<LibraryHit[]> {
  if (docs.length === 0 || !query.trim()) return [];
  const byId = new Map(docs.map((d) => [d.id, d]));
  const { hits } = await postJson<{ hits: PageHit[] }>("/api/library/search", {
    query,
    ids: docs.map((d) => d.id),
    limit,
  });
  return hits
    .filter((h) => byId.has(h.docId))
    .map(({ docId, ...h }) => ({ ...h, doc: byId.get(docId)! }));
}

// ---- Vehicle matching ----------------------------------------------------------

/** Does this document apply to the vehicle? Untagged documents never match. */
export function docMatchesVehicle(doc: LibraryDocument, vehicle: Vehicle): boolean {
  if (!doc.make) return false;
  const make = fold(doc.make).trim();
  const vMake = fold(vehicle.make).trim();
  if (!vMake.includes(make) && !make.includes(vMake)) return false;
  if (doc.model) {
    const model = fold(doc.model).trim();
    const vModel = fold(vehicle.model).trim();
    if (!vModel.includes(model) && !model.includes(vModel)) return false;
  }
  if (doc.yearFrom && vehicle.year < doc.yearFrom) return false;
  if (doc.yearTo && vehicle.year > doc.yearTo) return false;
  return true;
}

export function vehicleTagLabel(doc: LibraryDocument): string | null {
  const parts = [doc.make, doc.model, doc.engine].filter(Boolean).join(" ");
  const years =
    doc.yearFrom && doc.yearTo
      ? `${doc.yearFrom}–${doc.yearTo}`
      : doc.yearFrom
        ? `desde ${doc.yearFrom}`
        : doc.yearTo
          ? `hasta ${doc.yearTo}`
          : "";
  const label = [parts, years].filter(Boolean).join(" · ");
  return label || null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
