// Talleo — work order domain logic. All access goes through the repos; this
// module centralizes pipeline rules, access-code generation and the simulated
// notifications/messages so every view (shop + customer) stays in sync.

import type {
  Photo,
  QuoteItem,
  Tenant,
  User,
  WorkOrder,
  WorkOrderStatus,
} from "@/types";
import {
  listAllAccessCodes,
  notificationsRepo,
  uid,
  usersRepo,
  vehiclesRepo,
  workOrdersRepo,
} from "@/lib/db";

// Customer-facing pipeline (does not include `cancelado`, handled apart).
export const PIPELINE: WorkOrderStatus[] = [
  "recibido",
  "diagnostico",
  "presupuesto_enviado",
  "aprobado",
  "en_reparacion",
  "listo",
  "entregado",
];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  recibido: "Recibido",
  diagnostico: "Diagnóstico",
  presupuesto_enviado: "Presupuesto enviado",
  aprobado: "Aprobado",
  en_reparacion: "En reparación",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

// Photo labels offered when uploading.
export const PHOTO_LABELS: Array<{ value: Photo["label"]; label: string }> = [
  { value: "recepcion", label: "Recepción" },
  { value: "antes", label: "Antes" },
  { value: "despues", label: "Después" },
  { value: "detalle", label: "Detalle" },
];

export const PHOTO_LABEL_TEXT: Record<Photo["label"], string> = {
  recepcion: "Recepción",
  antes: "Antes",
  despues: "Después",
  detalle: "Detalle",
};

/**
 * Valid transitions from a given status: advance one step, step back one step,
 * and cancel. Terminal states (entregado, cancelado) have no transitions.
 */
export function nextStatuses(current: WorkOrderStatus): WorkOrderStatus[] {
  if (current === "entregado" || current === "cancelado") return [];
  const idx = PIPELINE.indexOf(current);
  const out: WorkOrderStatus[] = [];
  if (idx >= 0 && idx < PIPELINE.length - 1) out.push(PIPELINE[idx + 1]);
  if (idx > 0) out.push(PIPELINE[idx - 1]);
  out.push("cancelado");
  return out;
}

// Auto messages pushed to the customer timeline on certain status changes.
const STATUS_CUSTOMER_MESSAGE: Partial<Record<WorkOrderStatus, string>> = {
  diagnostico: "Estamos diagnosticando tu vehículo.",
  presupuesto_enviado: "Te hemos enviado un presupuesto para que lo revises.",
  aprobado: "Presupuesto aprobado. Comenzamos con la reparación.",
  en_reparacion: "Tu vehículo está en reparación.",
  listo: "¡Tu coche está listo para recoger!",
  entregado: "Vehículo entregado. ¡Gracias por confiar en nosotros!",
  cancelado: "La orden ha sido cancelada. Contáctanos para más información.",
};

function code6(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Generate a 6-char access code unique across every tenant. */
export function generateUniqueAccessCode(): string {
  const used = new Set(
    listAllAccessCodes().map((c) => c.code.toUpperCase()),
  );
  let c = code6();
  let guard = 0;
  while (used.has(c) && guard < 50) {
    c = code6();
    guard++;
  }
  return c;
}

/** Mechanics/owners that can be assigned to an order. */
export function listMechanics(tenantId: string): User[] {
  return usersRepo
    .list()
    .filter(
      (u) =>
        u.tenantId === tenantId &&
        (u.role === "mechanic" || u.role === "owner"),
    );
}

export function quoteTotals(items: QuoteItem[], taxRate: number) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const tax = subtotal * taxRate;
  return { subtotal, tax, total: subtotal + tax };
}

function vehicleLabel(tenantId: string, vehicleId: string): string {
  const v = vehiclesRepo.getById(tenantId, vehicleId);
  return v ? `${v.make} ${v.model} · ${v.plate}` : "Vehículo";
}

interface CreateOrderInput {
  customerId: string;
  vehicleId: string;
  mechanicId?: string;
  problemDescription: string;
}

/** Create an order in `recibido`, with a unique code + simulated notification. */
export function createWorkOrder(
  tenant: Tenant,
  input: CreateOrderInput,
): WorkOrder {
  const now = new Date().toISOString();
  const order = workOrdersRepo.create(tenant.id, {
    tenantId: tenant.id,
    locationId: tenant.locations[0]?.id ?? "",
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    mechanicId: input.mechanicId,
    status: "recibido",
    problemDescription: input.problemDescription,
    internalNotes: "",
    accessCode: generateUniqueAccessCode(),
    items: [],
    photos: [],
    messages: [
      {
        id: uid("m"),
        from: "shop",
        text: "Hemos recibido tu vehículo. Te mantendremos informado.",
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  } as Omit<WorkOrder, "id">);

  notificationsRepo.create(tenant.id, {
    tenantId: tenant.id,
    type: "estado",
    title: "Nueva orden creada",
    body: `${vehicleLabel(tenant.id, order.vehicleId)} — Recibido (${order.accessCode}).`,
    read: false,
    createdAt: now,
  });

  return order;
}

/** Move an order to a new status: timestamps, notification + customer message. */
export function changeOrderStatus(
  tenant: Tenant,
  order: WorkOrder,
  next: WorkOrderStatus,
): WorkOrder | undefined {
  const now = new Date().toISOString();
  const messages = [...order.messages];
  const auto = STATUS_CUSTOMER_MESSAGE[next];
  if (auto) {
    messages.push({ id: uid("m"), from: "shop", text: auto, createdAt: now });
  }

  const updated = workOrdersRepo.update(tenant.id, order.id, {
    status: next,
    updatedAt: now,
    messages,
  });

  notificationsRepo.create(tenant.id, {
    tenantId: tenant.id,
    type: "estado",
    title: `Estado: ${STATUS_LABELS[next]}`,
    body: `${vehicleLabel(tenant.id, order.vehicleId)} — ${STATUS_LABELS[next]}.`,
    read: false,
    createdAt: now,
  });

  return updated;
}

/** Append a shop message to the customer timeline. */
export function addShopMessage(
  tenantId: string,
  order: WorkOrder,
  text: string,
): WorkOrder | undefined {
  const now = new Date().toISOString();
  const messages = [
    ...order.messages,
    { id: uid("m"), from: "shop" as const, text, createdAt: now },
  ];
  return workOrdersRepo.update(tenantId, order.id, {
    messages,
    updatedAt: now,
  });
}

/** Append a photo (compressed base64) to the order. */
export function addOrderPhoto(
  tenantId: string,
  order: WorkOrder,
  photo: { url: string; label: Photo["label"]; note?: string },
): WorkOrder | undefined {
  const now = new Date().toISOString();
  const photos = [
    ...order.photos,
    {
      id: uid("ph"),
      url: photo.url,
      label: photo.label,
      note: photo.note,
      createdAt: now,
    },
  ];
  return workOrdersRepo.update(tenantId, order.id, {
    photos,
    updatedAt: now,
  });
}

export function removeOrderPhoto(
  tenantId: string,
  order: WorkOrder,
  photoId: string,
): WorkOrder | undefined {
  const photos = order.photos.filter((p) => p.id !== photoId);
  return workOrdersRepo.update(tenantId, order.id, {
    photos,
    updatedAt: new Date().toISOString(),
  });
}

/** Generic field update that also bumps updatedAt. */
export function updateOrder(
  tenantId: string,
  id: string,
  patch: Partial<WorkOrder>,
): WorkOrder | undefined {
  return workOrdersRepo.update(tenantId, id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}
