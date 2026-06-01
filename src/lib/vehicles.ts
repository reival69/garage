// Talleo — vehicle domain logic. Centralizes the stable public access code used
// by the permanent cartilla (/v/:code), the cross-tenant lookup helpers and the
// "vigent warranty" computation. All access goes through the repos; everything
// is local & simulated.

import type {
  FuelType,
  Photo,
  QuoteItem,
  Tenant,
  Transmission,
  Vehicle,
  WorkOrder,
} from "@/types";
import { listAllVehicleAccessCodes, uid, vehiclesRepo } from "@/lib/db";
import { getInvoiceByWorkOrderId } from "@/lib/invoices";
import { warrantyLabel } from "@/lib/quotes";

/** Human labels for the extended technical sheet. */
export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  gasolina: "Gasolina",
  diesel: "Diésel",
  electrico: "Eléctrico",
  hibrido: "Híbrido",
  glp: "GLP",
  otro: "Otro",
};

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  manual: "Manual",
  automatico: "Automático",
};

function code6(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Generate a 6-char vehicle access code unique across every tenant. */
export function generateUniqueVehicleAccessCode(): string {
  const used = new Set(
    listAllVehicleAccessCodes().map((c) => c.code.toUpperCase()),
  );
  let c = code6();
  let guard = 0;
  while (used.has(c) && guard < 50) {
    c = code6();
    guard++;
  }
  return c;
}

/** Relative path to a vehicle's permanent cartilla. */
export function cartillaPath(code: string): string {
  return `/v/${code}`;
}

/** Absolute, shareable URL to a vehicle's permanent cartilla. */
export function cartillaUrl(code: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/v/${code}`;
  }
  return `/v/${code}`;
}

/** Build a wa.me URL to share the cartilla with the customer (URLs only). */
export function whatsappCartillaUrl(opts: {
  phone?: string;
  tenantName: string;
  customerName?: string;
  vehicleLabel?: string;
  code: string;
}): string {
  const digits = (opts.phone ?? "").replace(/\D/g, "");
  const greeting = opts.customerName ? `Hola ${opts.customerName}, ` : "Hola, ";
  const vehiclePart = opts.vehicleLabel ? ` de tu ${opts.vehicleLabel}` : "";
  const msg =
    `${greeting}te compartimos desde ${opts.tenantName} la cartilla digital${vehiclePart}. ` +
    `Aquí tienes el historial completo, garantías y próximas revisiones: ${cartillaUrl(opts.code)}`;
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(msg)}`;
}

/** The vehicle's active (in-progress) order, if any. Expects newest-first list. */
export function findActiveOrder(orders: WorkOrder[]): WorkOrder | undefined {
  return orders.find(
    (o) => o.status !== "entregado" && o.status !== "cancelado",
  );
}

export interface ActiveWarranty {
  order: WorkOrder;
  item: QuoteItem;
  label: string;
  /** Date the warranty expires (when a month limit applies). */
  untilDate?: string;
  /** Odometer at which the warranty expires (when a km limit applies). */
  untilKm?: number;
}

/**
 * Compute whether a warranty line is still valid given the order's delivery
 * date and the vehicle's current odometer. When both limits apply, the warranty
 * is valid only while BOTH still hold (whichever limit is reached first ends it).
 */
function evaluateWarranty(
  item: QuoteItem,
  order: WorkOrder,
  vehicle: Vehicle,
  deliveryIso: string,
): ActiveWarranty | null {
  const hasMonths = item.warrantyMonths != null && item.warrantyMonths > 0;
  const hasKm = item.warrantyKm != null && item.warrantyKm > 0;
  if (!hasMonths && !hasKm) return null;

  const now = new Date();
  let untilDate: string | undefined;
  let monthsOk = true;
  if (hasMonths) {
    const expiry = new Date(deliveryIso);
    expiry.setMonth(expiry.getMonth() + (item.warrantyMonths as number));
    untilDate = expiry.toISOString();
    monthsOk = expiry > now;
  }

  let untilKm: number | undefined;
  let kmOk = true;
  if (hasKm) {
    // Odometer at the time of service (fallback: can't determine → treat as valid).
    const serviceKm = order.checkIn?.km;
    if (serviceKm != null) {
      untilKm = serviceKm + (item.warrantyKm as number);
      kmOk = vehicle.km < untilKm;
    }
  }

  const active =
    hasMonths && hasKm ? monthsOk && kmOk : hasMonths ? monthsOk : kmOk;
  if (!active) return null;

  return {
    order,
    item,
    label: warrantyLabel(item) ?? "",
    untilDate,
    untilKm,
  };
}

/**
 * Every still-valid warranty line across the vehicle's delivered orders.
 * Only approved lines from delivered orders carry an active warranty.
 */
export function listActiveWarranties(
  tenantId: string,
  vehicle: Vehicle,
  orders: WorkOrder[],
): ActiveWarranty[] {
  const out: ActiveWarranty[] = [];
  for (const order of orders) {
    if (order.status !== "entregado") continue;
    const invoice = getInvoiceByWorkOrderId(tenantId, order.id);
    const deliveryIso = invoice?.createdAt ?? order.updatedAt;
    for (const item of order.items) {
      if (item.approval !== "approved") continue;
      const w = evaluateWarranty(item, order, vehicle, deliveryIso);
      if (w) out.push(w);
    }
  }
  return out;
}

/** Look up the latest odometer reading for display convenience. */
export function vehicleById(tenantId: string, id: string): Vehicle | undefined {
  return vehiclesRepo.getById(tenantId, id);
}

/* -------------------------------------------------------------------------- */
/* Vehicle photo gallery (vehicle-level, independent from order photos).      */
/* -------------------------------------------------------------------------- */

/** Append a compressed photo to the vehicle's own gallery. */
export function addVehiclePhoto(
  tenantId: string,
  vehicle: Vehicle,
  photo: { url: string; label: Photo["label"]; note?: string },
): Vehicle | undefined {
  const next: Photo = {
    id: uid("vph"),
    url: photo.url,
    label: photo.label,
    note: photo.note,
    createdAt: new Date().toISOString(),
  };
  const photos = [...(vehicle.photos ?? []), next];
  // First photo automatically becomes the cover.
  const coverPhotoId = vehicle.coverPhotoId ?? next.id;
  return vehiclesRepo.update(tenantId, vehicle.id, { photos, coverPhotoId });
}

/** Remove a photo from the vehicle gallery, fixing the cover if needed. */
export function removeVehiclePhoto(
  tenantId: string,
  vehicle: Vehicle,
  photoId: string,
): Vehicle | undefined {
  const photos = (vehicle.photos ?? []).filter((p) => p.id !== photoId);
  let coverPhotoId = vehicle.coverPhotoId;
  if (coverPhotoId === photoId) coverPhotoId = photos[0]?.id;
  return vehiclesRepo.update(tenantId, vehicle.id, { photos, coverPhotoId });
}

/** Mark a gallery photo as the cartilla cover. */
export function setVehicleCoverPhoto(
  tenantId: string,
  vehicle: Vehicle,
  photoId: string,
): Vehicle | undefined {
  return vehiclesRepo.update(tenantId, vehicle.id, { coverPhotoId: photoId });
}

/** The cover photo object, if set and still present. */
export function coverPhoto(vehicle: Vehicle): Photo | undefined {
  const photos = vehicle.photos ?? [];
  return photos.find((p) => p.id === vehicle.coverPhotoId) ?? photos[0];
}

/** Gallery photos excluding the cover (shown as the rest of the gallery). */
export function galleryPhotos(vehicle: Vehicle): Photo[] {
  const cover = coverPhoto(vehicle);
  return (vehicle.photos ?? []).filter((p) => p.id !== cover?.id);
}

/* -------------------------------------------------------------------------- */
/* Accumulated spend across the vehicle's invoices.                           */
/* -------------------------------------------------------------------------- */

export interface VehicleSpend {
  /** Total invested (sum of invoice line items, currency units). */
  total: number;
  /** Split between labor and parts. */
  byType: { labor: number; part: number };
  /** Totals grouped by calendar year, oldest first. */
  byYear: Array<{ year: number; total: number }>;
}

/**
 * Aggregate everything the customer has spent on a vehicle, derived from the
 * invoices generated for its delivered orders. Uses line items so the
 * labour/parts and per-year breakdowns add up to the same total.
 */
export function computeVehicleSpend(
  tenantId: string,
  orders: WorkOrder[],
): VehicleSpend {
  let labor = 0;
  let part = 0;
  const yearMap = new Map<number, number>();

  for (const order of orders) {
    const invoice = getInvoiceByWorkOrderId(tenantId, order.id);
    if (!invoice) continue;
    const year = new Date(invoice.createdAt).getFullYear();
    for (const item of invoice.items) {
      const amount = item.qty * item.unitPrice;
      if (item.type === "labor") labor += amount;
      else part += amount;
      yearMap.set(year, (yearMap.get(year) ?? 0) + amount);
    }
  }

  const byYear = [...yearMap.entries()]
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => a.year - b.year);

  return { total: labor + part, byType: { labor, part }, byYear };
}

/* -------------------------------------------------------------------------- */
/* Odometer (km) history.                                                     */
/* -------------------------------------------------------------------------- */

export interface KmPoint {
  date: string; // ISO
  km: number;
}

export interface KmHistory {
  points: KmPoint[];
  /** Km driven between the first and last point. */
  delta: number;
  /** Whole months spanned by the series (>= 0). */
  months: number;
}

/**
 * Build an odometer series from the check-in readings of the vehicle's orders
 * plus its current km, sorted oldest first and de-duplicated by reading.
 */
export function buildKmHistory(
  vehicle: Vehicle,
  orders: WorkOrder[],
): KmHistory {
  const raw: KmPoint[] = [];
  for (const order of orders) {
    if (order.checkIn?.km != null) {
      raw.push({ date: order.checkIn.createdAt, km: order.checkIn.km });
    }
  }
  raw.push({ date: new Date().toISOString(), km: vehicle.km });

  raw.sort((a, b) => a.date.localeCompare(b.date));

  // Collapse consecutive duplicate km readings, keeping the earliest date.
  const points: KmPoint[] = [];
  for (const p of raw) {
    const last = points[points.length - 1];
    if (last && last.km === p.km) continue;
    points.push(p);
  }

  const first = points[0];
  const last = points[points.length - 1];
  const delta = first && last ? Math.max(0, last.km - first.km) : 0;
  let months = 0;
  if (first && last) {
    const ms = new Date(last.date).getTime() - new Date(first.date).getTime();
    months = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 30)));
  }

  return { points, delta, months };
}
