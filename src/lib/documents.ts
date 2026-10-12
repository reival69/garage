// Garage — vehicle documents & expiry logic. Centralizes CRUD over a vehicle's
// documents (ITV, insurance, road tax, …), the traffic-light expiry status and
// the notification sweep that surfaces upcoming/expired documents in the
// existing notification center. All access goes through the repos; everything
// is local & simulated.

import type { Vehicle, VehicleDocument, VehicleDocumentType } from "@/types";
import { uid, vehiclesRepo } from "@/lib/db";
import { notify } from "@/lib/notifications";

export type DocumentStatus = "vigente" | "por_vencer" | "vencido";

/** Human labels for each document type. */
export const DOCUMENT_TYPE_LABELS: Record<VehicleDocumentType, string> = {
  itv: "ITV",
  seguro: "Seguro",
  impuesto: "Impuesto de circulación",
  permiso: "Permiso de circulación",
  ficha_tecnica: "Ficha técnica",
  otro: "Otro",
};

export const DOCUMENT_TYPES: Array<{ value: VehicleDocumentType; label: string }> =
  (Object.keys(DOCUMENT_TYPE_LABELS) as VehicleDocumentType[]).map((value) => ({
    value,
    label: DOCUMENT_TYPE_LABELS[value],
  }));

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
};

/** Display name: the custom label for "otro", otherwise the type label. */
export function documentLabel(doc: VehicleDocument): string {
  if (doc.type === "otro" && doc.label?.trim()) return doc.label.trim();
  return DOCUMENT_TYPE_LABELS[doc.type];
}

const DAY_MS = 86_400_000;
const SOON_DAYS = 30;

/** Whole days until the document expires (negative = already expired). */
export function daysUntilExpiry(doc: VehicleDocument): number | undefined {
  if (!doc.expiryDate) return undefined;
  return Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / DAY_MS);
}

/** Traffic-light status: vigente / por vencer (≤30 días) / vencido. */
export function documentStatus(doc: VehicleDocument): DocumentStatus {
  const diff = daysUntilExpiry(doc);
  if (diff == null) return "vigente"; // no expiry date → always valid
  if (diff < 0) return "vencido";
  if (diff <= SOON_DAYS) return "por_vencer";
  return "vigente";
}

/* ------------------------------------------------------------------ CRUD --- */

export interface DocumentInput {
  type: VehicleDocumentType;
  label?: string;
  expiryDate?: string;
  note?: string;
  fileBase64?: string;
  fileName?: string;
}

/** Documents for a vehicle, expiring-soonest first. */
export function listVehicleDocuments(vehicle: Vehicle): VehicleDocument[] {
  return [...(vehicle.documents ?? [])].sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
    if (a.expiryDate) return -1;
    if (b.expiryDate) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Add a document to the vehicle. */
export function addVehicleDocument(
  tenantId: string,
  vehicleId: string,
  input: DocumentInput,
): Vehicle | undefined {
  const vehicle = vehiclesRepo.getById(tenantId, vehicleId);
  if (!vehicle) return undefined;
  const doc: VehicleDocument = {
    id: uid("vdoc"),
    tenantId,
    vehicleId,
    type: input.type,
    label: input.label?.trim() || undefined,
    expiryDate: input.expiryDate || undefined,
    note: input.note?.trim() || undefined,
    fileBase64: input.fileBase64,
    fileName: input.fileName,
    notified: false,
    createdAt: new Date().toISOString(),
  };
  const documents = [...(vehicle.documents ?? []), doc];
  return vehiclesRepo.update(tenantId, vehicleId, { documents });
}

/** Update an existing document (re-arms the expiry notification). */
export function updateVehicleDocument(
  tenantId: string,
  vehicleId: string,
  docId: string,
  input: DocumentInput,
): Vehicle | undefined {
  const vehicle = vehiclesRepo.getById(tenantId, vehicleId);
  if (!vehicle) return undefined;
  const documents = (vehicle.documents ?? []).map((d) =>
    d.id === docId
      ? {
          ...d,
          type: input.type,
          label: input.label?.trim() || undefined,
          expiryDate: input.expiryDate || undefined,
          note: input.note?.trim() || undefined,
          fileBase64: input.fileBase64,
          fileName: input.fileName,
          // Re-arm the notification when the document is edited.
          notified: false,
        }
      : d,
  );
  return vehiclesRepo.update(tenantId, vehicleId, { documents });
}

/** Remove a document from the vehicle. */
export function removeVehicleDocument(
  tenantId: string,
  vehicleId: string,
  docId: string,
): Vehicle | undefined {
  const vehicle = vehiclesRepo.getById(tenantId, vehicleId);
  if (!vehicle) return undefined;
  const documents = (vehicle.documents ?? []).filter((d) => d.id !== docId);
  return vehiclesRepo.update(tenantId, vehicleId, { documents });
}

/* ----------------------------------------------------------- Expiry sweep -- */

/**
 * Emit a notification for every document that is por vencer / vencido and not
 * yet notified, then mark it as notified so it only fires once. Runs on shop
 * view load, mirroring evaluateReminders().
 */
export function evaluateDocumentExpiries(tenantId: string): number {
  let emitted = 0;
  for (const vehicle of vehiclesRepo.list(tenantId)) {
    const docs = vehicle.documents ?? [];
    if (docs.length === 0) continue;
    let changed = false;
    const updated = docs.map((doc) => {
      if (doc.notified) return doc;
      const status = documentStatus(doc);
      if (status !== "por_vencer" && status !== "vencido") return doc;
      const vLabel = `${vehicle.make} ${vehicle.model} · ${vehicle.plate}`;
      notify(tenantId, {
        type: "recordatorio",
        title: status === "vencido" ? "Documento vencido" : "Documento por vencer",
        body: `${documentLabel(doc)} — ${vLabel}.`,
        link: `/app/vehiculos/${vehicle.id}`,
      });
      emitted += 1;
      changed = true;
      return { ...doc, notified: true };
    });
    if (changed) vehiclesRepo.update(tenantId, vehicle.id, { documents: updated });
  }
  return emitted;
}
