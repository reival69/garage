// Talleo — digital vehicle inspection (DVI) domain logic. Centralizes the
// default multi-point template, the traffic-light summary and persistence of
// the inspection into order.inspection. All access goes through the repos and
// reuses the photo helpers; no component touches localStorage directly.

import type { Inspection, InspectionItem, WorkOrder } from "@/types";
import { uid, workOrdersRepo } from "@/lib/db";
import { addOrderPhoto, removeOrderPhoto } from "@/lib/orders";
import { compressImage } from "@/lib/image";

/** Default ~12-point inspection template. */
export const DEFAULT_INSPECTION_POINTS: string[] = [
  "Frenos delanteros",
  "Frenos traseros",
  "Neumáticos delanteros",
  "Neumáticos traseros",
  "Nivel de aceite",
  "Líquido refrigerante",
  "Líquido de frenos",
  "Batería",
  "Luces",
  "Limpiaparabrisas",
  "Suspensión / amortiguadores",
  "Sistema de escape",
];

export const INSPECTION_STATUS_LABELS: Record<InspectionItem["status"], string> = {
  ok: "OK",
  atencion: "Atención",
  critico: "Crítico",
};

/** Build a fresh inspection item, defaulting to `ok`. */
export function makeInspectionItem(name: string): InspectionItem {
  return { id: uid("ii"), name: name.trim() || "Punto sin nombre", status: "ok" };
}

/** Build an inspection draft from the default template. */
export function createInspectionDraft(): Inspection {
  return {
    items: DEFAULT_INSPECTION_POINTS.map(makeInspectionItem),
    createdAt: new Date().toISOString(),
  };
}

/** Count of points by traffic-light status. */
export function inspectionSummary(items: InspectionItem[]) {
  return {
    total: items.length,
    ok: items.filter((i) => i.status === "ok").length,
    atencion: items.filter((i) => i.status === "atencion").length,
    critico: items.filter((i) => i.status === "critico").length,
  };
}

/** Persist an inspection into the order (bumps updatedAt). */
export function saveInspection(
  tenantId: string,
  orderId: string,
  inspection: Inspection,
): WorkOrder | undefined {
  return workOrdersRepo.update(tenantId, orderId, {
    inspection,
    updatedAt: new Date().toISOString(),
  });
}

/** Create + persist a default inspection for the order. */
export function startInspection(
  tenantId: string,
  orderId: string,
): { order: WorkOrder | undefined; inspection: Inspection } {
  const inspection = createInspectionDraft();
  const order = saveInspection(tenantId, orderId, inspection);
  return { order, inspection };
}

/**
 * Compress + attach a "detalle" photo to the order and return its id so the
 * caller can store it in item.photoId. Reads a fresh order to avoid clobbering
 * concurrent photo additions.
 */
export async function addDetailPhoto(
  tenantId: string,
  orderId: string,
  file: File,
): Promise<string | undefined> {
  const order = workOrdersRepo.getById(tenantId, orderId);
  if (!order) return undefined;
  const url = await compressImage(file);
  const updated = addOrderPhoto(tenantId, order, { url, label: "detalle" });
  if (!updated) return undefined;
  return updated.photos[updated.photos.length - 1]?.id;
}

/** Remove a photo previously attached to an inspection item. */
export function removeDetailPhoto(
  tenantId: string,
  orderId: string,
  photoId: string,
): void {
  const order = workOrdersRepo.getById(tenantId, orderId);
  if (!order) return;
  removeOrderPhoto(tenantId, order, photoId);
}
