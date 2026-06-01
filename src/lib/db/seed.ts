// Talleo — demo seed data. Everything is local and simulated.

import type {
  Appointment,
  AppNotification,
  Customer,
  Invoice,
  MaintenanceReminder,
  Part,
  Plan,
  QuoteItem,
  Review,
  Service,
  Tenant,
  User,
  Vehicle,
  VehicleDocument,
  WorkOrder,
  WorkOrderStatus,
} from "@/types";
import {
  appointmentsRepo,
  customersRepo,
  invoicesRepo,
  notificationsRepo,
  partsRepo,
  plansRepo,
  remindersRepo,
  reviewsRepo,
  servicesRepo,
  tenantsRepo,
  usersRepo,
  vehiclesRepo,
  workOrdersRepo,
} from "./repos";
import { clearAll, readRaw, uid, writeRaw } from "./storage";
import { quoteTotals } from "@/lib/orders";

const SEED_FLAG = "seeded";
// Bump when the seed shape changes to force a clean reseed of the demo.
const SEED_VERSION = "7";

// Tiny base64 placeholder images (kept small to respect the ~5MB quota).
const PHOTO_A =
  "data:image/svg+xml;base64," +
  btoaSafe(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='100%' height='100%' fill='#e4e4e7'/><text x='50%' y='52%' font-family='sans-serif' font-size='14' fill='#71717a' text-anchor='middle'>Recepcion</text></svg>`,
  );
const PHOTO_B =
  "data:image/svg+xml;base64," +
  btoaSafe(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='100%' height='100%' fill='#d4d4d8'/><text x='50%' y='52%' font-family='sans-serif' font-size='14' fill='#52525b' text-anchor='middle'>Detalle</text></svg>`,
  );
// Vehicle-level cover/gallery placeholders (replaced by real photos later).
const PHOTO_COVER =
  "data:image/svg+xml;base64," +
  btoaSafe(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><rect width='100%' height='100%' fill='#cbd5e1'/><text x='50%' y='52%' font-family='sans-serif' font-size='18' fill='#475569' text-anchor='middle'>Portada</text></svg>`,
  );
const PHOTO_GALLERY =
  "data:image/svg+xml;base64," +
  btoaSafe(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='100%' height='100%' fill='#e2e8f0'/><text x='50%' y='52%' font-family='sans-serif' font-size='14' fill='#64748b' text-anchor='middle'>Foto</text></svg>`,
  );
// Tiny placeholder "signature" (a small scribble) kept as light base64.
const SIGNATURE =
  "data:image/svg+xml;base64," +
  btoaSafe(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='60'><path d='M8 44 C28 8, 44 52, 62 28 S92 8, 110 40 S150 18, 172 34' fill='none' stroke='#101010' stroke-width='2'/></svg>`,
  );

function btoaSafe(s: string): string {
  if (typeof window !== "undefined" && window.btoa) return window.btoa(s);
  return "";
}

function code6(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function daysFromNow(days: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 3600_000).toISOString();
}

// ---- Plans -----------------------------------------------------------------

const PLANS: Plan[] = [
  {
    id: "plan_basico",
    name: "Básico",
    tier: "basico",
    priceMonthly: 29,
    limits: { maxOrders: 50, maxUsers: 3, maxPhotosPerOrder: 6 },
  },
  {
    id: "plan_pro",
    name: "Pro",
    tier: "pro",
    priceMonthly: 79,
    limits: { maxOrders: 300, maxUsers: 10, maxPhotosPerOrder: 15 },
  },
  {
    id: "plan_premium",
    name: "Premium",
    tier: "premium",
    priceMonthly: 149,
    limits: { maxOrders: 2000, maxUsers: 50, maxPhotosPerOrder: 40 },
  },
];

// ---- Catalog (prices are scaled by the tenant currency factor) -------------

const SERVICE_NAMES: Array<[string, number, number]> = [
  ["Cambio de aceite y filtro", 65, 45],
  ["Revisión de frenos", 90, 60],
  ["Cambio de embrague", 480, 240],
  ["Diagnóstico electrónico", 45, 30],
  ["Alineación y equilibrado", 70, 50],
  ["Cambio de batería", 40, 25],
  ["Distribución (correa)", 350, 180],
];

const PART_NAMES: Array<[string, number, string]> = [
  ["Filtro de aceite", 12.5, "FO-1024"],
  ["Pastillas de freno delanteras", 48.0, "PF-2048"],
  ["Aceite sintético 5W30 (1L)", 9.9, "AC-5W30"],
  ["Batería 70Ah", 95.0, "BAT-70"],
  ["Neumático 205/55 R16", 78.0, "NE-2055"],
  ["Kit de embrague", 210.0, "EMB-KIT"],
];

// ---- Per-tenant seed shapes ------------------------------------------------

interface CustomerSeed {
  name: string;
  phone: string;
  email: string;
}

interface VehicleSeed {
  make: string;
  model: string;
  year: number;
  plate: string;
  km: number;
  color: string;
  customerIdx: number;
}

interface QuoteLineSeed {
  type: "labor" | "part";
  description: string;
  qty: number;
  unitPrice: number; // in base EUR; scaled by the tenant factor
  rejected?: boolean; // becomes "rejected" once the customer decides
  warrantyMonths?: number;
  warrantyKm?: number;
}

interface OrderSeed {
  vehicleIdx: number;
  status: WorkOrderStatus;
  problem: string;
  lines?: QuoteLineSeed[];
  inspection?: Array<["ok" | "atencion" | "critico", string, string?]>;
  checkin?: { km: number; fuel: number; damage?: boolean };
  invoiceStatus?: Invoice["status"]; // delivered orders only
  review?: { rating: number; comment?: string };
  customerMessage?: string;
}

interface ReminderSeed {
  vehicleIdx: number;
  label: string;
  dueInDays?: number; // negative = overdue
  dueKmDelta?: number; // negative = already past (overdue)
  note?: string;
}

interface TenantSeed {
  tenant: Tenant;
  accent: string;
  ownerName: string;
  customers: CustomerSeed[];
  vehicles: VehicleSeed[];
  orders: OrderSeed[];
  reminders: ReminderSeed[];
  priceFactor: number; // 1 for EUR, ~20 for MXN
}

// Shared inspection presets reused across orders.
const INSP_MIXED: Array<["ok" | "atencion" | "critico", string, string?]> = [
  ["ok", "Niveles de líquidos"],
  ["atencion", "Pastillas de freno traseras", "Al 30%, vigilar"],
  ["critico", "Pastillas de freno delanteras", "Sustitución urgente"],
  ["ok", "Neumáticos"],
  ["atencion", "Batería", "Carga baja"],
];

const INSP_OK: Array<["ok" | "atencion" | "critico", string, string?]> = [
  ["ok", "Niveles de líquidos"],
  ["ok", "Frenos"],
  ["atencion", "Filtro de aire", "Recomendado cambio próxima revisión"],
  ["ok", "Iluminación"],
];

// Showcase history applied to each tenant's vehicle 0: delivered orders spread
// across past years (each with its own invoice + check-in) so the public
// cartilla shows multi-year spend and a clearly rising odometer. kmRatio is the
// fraction of the vehicle's current km recorded at that point in time.
const SHOWCASE_ORDERS: Array<{
  yearsAgo: number;
  kmRatio: number;
  problem: string;
  lines: QuoteLineSeed[];
}> = [
  {
    yearsAgo: 4,
    kmRatio: 0.62,
    problem: "Revisión general y cambio de aceite",
    lines: [
      { type: "labor", description: "Mano de obra — revisión", qty: 2, unitPrice: 45 },
      { type: "part", description: "Aceite sintético 5W30 (4L)", qty: 4, unitPrice: 10 },
      { type: "part", description: "Filtro de aceite", qty: 1, unitPrice: 12 },
    ],
  },
  {
    yearsAgo: 3,
    kmRatio: 0.74,
    problem: "Distribución y bomba de agua",
    lines: [
      { type: "labor", description: "Mano de obra — distribución", qty: 3, unitPrice: 45 },
      { type: "part", description: "Kit de distribución", qty: 1, unitPrice: 180, warrantyMonths: 24, warrantyKm: 60000 },
    ],
  },
  {
    yearsAgo: 2,
    kmRatio: 0.86,
    problem: "Frenos delanteros y traseros",
    lines: [
      { type: "labor", description: "Mano de obra — frenos", qty: 2, unitPrice: 45 },
      { type: "part", description: "Pastillas de freno delanteras", qty: 1, unitPrice: 48, warrantyMonths: 12 },
      { type: "part", description: "Discos de freno delanteros", qty: 2, unitPrice: 65 },
    ],
  },
];

// ---- Builders --------------------------------------------------------------

function quoteApproved(status: WorkOrderStatus): boolean {
  return (
    status === "aprobado" ||
    status === "en_reparacion" ||
    status === "listo" ||
    status === "entregado"
  );
}

function buildItems(
  lines: QuoteLineSeed[] | undefined,
  status: WorkOrderStatus,
  f: number,
): QuoteItem[] {
  if (!lines) return [];
  const decided = quoteApproved(status);
  return lines.map((l) => ({
    id: uid("qi"),
    type: l.type,
    description: l.description,
    qty: l.qty,
    unitPrice: Math.round(l.unitPrice * f),
    approval: l.rejected
      ? ("rejected" as const)
      : decided
        ? ("approved" as const)
        : ("pending" as const),
    ...(l.warrantyMonths ? { warrantyMonths: l.warrantyMonths } : {}),
    ...(l.warrantyKm ? { warrantyKm: l.warrantyKm } : {}),
  }));
}

function seedTenant(ts: TenantSeed): void {
  const { tenant, f } = { tenant: ts.tenant, f: ts.priceFactor };
  tenantsRepo.create(tenant);
  const t = tenant.id;
  const locationId = tenant.locations[0].id;

  // Users — owner (full access), staff (reception), mechanic.
  usersRepo.create({
    tenantId: t,
    name: ts.ownerName,
    email: `owner@${tenant.slug}.app`,
    role: "owner",
    locationId,
    active: true,
  } as Omit<User, "id">);
  usersRepo.create({
    tenantId: t,
    name: "Recepción",
    email: `recepcion@${tenant.slug}.app`,
    role: "staff",
    locationId,
    active: true,
  } as Omit<User, "id">);
  const mechanic = usersRepo.create({
    tenantId: t,
    name: "Taller",
    email: `taller@${tenant.slug}.app`,
    role: "mechanic",
    locationId,
    active: true,
  } as Omit<User, "id">);

  // Services & parts (scaled by currency factor).
  SERVICE_NAMES.forEach(([name, basePrice, estimatedMinutes]) =>
    servicesRepo.create(t, {
      tenantId: t,
      name,
      basePrice: Math.round(basePrice * f),
      estimatedMinutes,
    } as Omit<Service, "id">),
  );
  PART_NAMES.forEach(([name, price, sku]) =>
    partsRepo.create(t, {
      tenantId: t,
      name,
      price: Math.round(price * f),
      sku,
    } as Omit<Part, "id">),
  );

  // Customers
  const customers: Customer[] = ts.customers.map((c, i) =>
    customersRepo.create(t, {
      tenantId: t,
      name: c.name,
      phone: c.phone,
      email: c.email,
      createdAt: daysAgo(40 + i * 9),
    } as Omit<Customer, "id">),
  );

  // Vehicles
  const FUELS = ["gasolina", "diesel", "hibrido", "gasolina", "diesel", "glp"] as const;
  const TRANS = ["manual", "automatico", "manual", "automatico"] as const;
  const CCS = [1598, 1968, 1497, 1995, 999, 1796];
  const HPS = [115, 150, 130, 190, 95, 140];
  const vehicles: Vehicle[] = ts.vehicles.map((v, vi) => {
    const coverId = uid("vph");
    const galId = uid("vph");
    return vehiclesRepo.create(t, {
      tenantId: t,
      customerId: customers[v.customerIdx % customers.length].id,
      accessCode: code6(),
      plate: v.plate,
      make: v.make,
      model: v.model,
      year: v.year,
      km: v.km,
      color: v.color,
      fuelType: FUELS[vi % FUELS.length],
      transmission: TRANS[vi % TRANS.length],
      displacementCc: CCS[vi % CCS.length],
      powerHp: HPS[vi % HPS.length],
      coverPhotoId: coverId,
      photos: [
        { id: coverId, url: PHOTO_COVER, label: "detalle", createdAt: daysAgo(60 + vi) },
        { id: galId, url: PHOTO_GALLERY, label: "detalle", createdAt: daysAgo(50 + vi) },
      ],
    } as Omit<Vehicle, "id">);
  });

  // Work orders
  ts.orders.forEach((spec, i) => {
    const v = vehicles[spec.vehicleIdx % vehicles.length];
    const items = buildItems(spec.lines, spec.status, f);
    const decided = quoteApproved(spec.status);
    // Delivered orders are spread across past months/years so the km trend and
    // the per-year spend breakdown show history; active orders stay recent.
    const delivered = spec.status === "entregado";
    const ageDays = delivered ? 120 + i * 95 : 0;
    const baseIso = delivered ? daysAgo(ageDays) : hoursAgo(50 - i * 2);
    const checkInIso = delivered ? daysAgo(ageDays) : hoursAgo(47 - i);
    // Delivery/invoice happen a few days after intake for delivered orders.
    const deliveredIso = delivered ? daysAgo(Math.max(ageDays - 3, 0)) : hoursAgo(2 + i);

    const order = workOrdersRepo.create(t, {
      tenantId: t,
      locationId,
      customerId: v.customerId,
      vehicleId: v.id,
      mechanicId: mechanic.id,
      status: spec.status,
      problemDescription: spec.problem,
      internalNotes: "Cliente avisado por teléfono.",
      accessCode: code6(),
      items,
      photos: [
        { id: uid("ph"), url: PHOTO_A, label: "recepcion", createdAt: hoursAgo(48 - i) },
        { id: uid("ph"), url: PHOTO_B, label: "detalle", createdAt: hoursAgo(40 - i) },
      ],
      checkIn: spec.checkin
        ? {
            km: spec.checkin.km,
            fuelLevel: spec.checkin.fuel,
            bodyDamage: spec.checkin.damage
              ? [{ x: 0.32, y: 0.45, note: "Rayón en puerta delantera" }]
              : [],
            customerSignature: SIGNATURE,
            createdAt: checkInIso,
          }
        : undefined,
      inspection: spec.inspection
        ? {
            items: spec.inspection.map(([status, name, note]) => ({
              id: uid("ins"),
              name,
              status,
              note,
            })),
            createdAt: hoursAgo(44 - i),
          }
        : undefined,
      messages: [
        {
          id: uid("m"),
          from: "shop",
          text: "Hemos recibido su vehículo, le mantendremos informado.",
          createdAt: hoursAgo(46 - i),
        },
        ...(spec.customerMessage
          ? [
              {
                id: uid("m"),
                from: "customer" as const,
                text: spec.customerMessage,
                createdAt: hoursAgo(20),
              },
            ]
          : []),
      ],
      quoteApproval: decided
        ? { signature: SIGNATURE, decidedAt: hoursAgo(30 - i) }
        : undefined,
      estimatedReadyAt: daysFromNow((i % 3) + 1, 18),
      createdAt: baseIso,
      updatedAt: deliveredIso,
    } as Omit<WorkOrder, "id">);

    // Invoice for delivered orders (mix of paid/pending).
    if (spec.status === "entregado" && spec.invoiceStatus) {
      const approved = order.items.filter((it) => it.approval === "approved");
      if (approved.length) {
        const { subtotal, tax, total } = quoteTotals(approved, tenant.taxRate);
        invoicesRepo.create(t, {
          tenantId: t,
          workOrderId: order.id,
          number: nextNumber(t),
          items: approved.map((it) => ({ ...it })),
          subtotal,
          tax,
          total,
          status: spec.invoiceStatus,
          createdAt: deliveredIso,
        } as Omit<Invoice, "id">);
      }
    }

    // Review for delivered orders that left feedback.
    if (spec.status === "entregado" && spec.review) {
      reviewsRepo.create(t, {
        tenantId: t,
        orderId: order.id,
        customerId: order.customerId,
        vehicleId: order.vehicleId,
        rating: spec.review.rating,
        comment: spec.review.comment,
        createdAt: hoursAgo(12 - i),
      } as Omit<Review, "id">);
    }
  });

  // Showcase vehicle (vehicle 0): multi-year delivered history so its public
  // cartilla shows spend across several years and a clearly rising odometer.
  const showcase = vehicles[0];
  if (showcase) {
    SHOWCASE_ORDERS.forEach((s, si) => {
      const items = buildItems(s.lines, "entregado", f);
      const createdIso = daysAgo(s.yearsAgo * 365 + 20 - si * 3);
      const deliveredIso = daysAgo(s.yearsAgo * 365 + 16 - si * 3);
      const km = Math.max(1000, Math.round(showcase.km * s.kmRatio));
      const order = workOrdersRepo.create(t, {
        tenantId: t,
        locationId,
        customerId: showcase.customerId,
        vehicleId: showcase.id,
        mechanicId: mechanic.id,
        status: "entregado",
        problemDescription: s.problem,
        internalNotes: "",
        accessCode: code6(),
        items,
        photos: [],
        checkIn: {
          km,
          fuelLevel: 50,
          bodyDamage: [],
          customerSignature: SIGNATURE,
          createdAt: createdIso,
        },
        messages: [],
        quoteApproval: { signature: SIGNATURE, decidedAt: createdIso },
        createdAt: createdIso,
        updatedAt: deliveredIso,
      } as Omit<WorkOrder, "id">);

      const { subtotal, tax, total } = quoteTotals(order.items, tenant.taxRate);
      invoicesRepo.create(t, {
        tenantId: t,
        workOrderId: order.id,
        number: nextNumber(t),
        items: order.items.map((it) => ({ ...it })),
        subtotal,
        tax,
        total,
        status: "paid",
        createdAt: deliveredIso,
      } as Omit<Invoice, "id">);
    });
  }

  // Appointments — today and upcoming, including online bookings.
  const appts: Array<[number, number, Appointment["status"], "online" | "manual"]> = [
    [0, 9, "confirmada", "online"],
    [0, 12, "programada", "manual"],
    [0, 16, "en_taller", "online"],
    [1, 10, "programada", "online"],
    [2, 11, "confirmada", "manual"],
  ];
  appts.forEach(([d, h, status, source], i) => {
    const v = vehicles[i % vehicles.length];
    appointmentsRepo.create(t, {
      tenantId: t,
      locationId,
      customerId: v.customerId,
      vehicleId: v.id,
      serviceIds: [],
      scheduledAt: daysFromNow(d, h),
      status,
      source,
    } as Omit<Appointment, "id">);
  });

  // Reminders — a mix of overdue and upcoming (drive dashboard + bell activity).
  ts.reminders.forEach((r) => {
    const v = vehicles[r.vehicleIdx % vehicles.length];
    remindersRepo.create(t, {
      tenantId: t,
      vehicleId: v.id,
      customerId: v.customerId,
      label: r.label,
      dueDate: r.dueInDays != null ? daysFromNow(r.dueInDays, 9) : undefined,
      dueKm: r.dueKmDelta != null ? v.km + r.dueKmDelta : undefined,
      note: r.note,
      status: "pending",
      notified: false,
      createdAt: daysAgo(15),
    } as Omit<MaintenanceReminder, "id">);
  });

  // Notifications — several unread so the bell shows activity.
  const notifs: Array<[AppNotification["type"], string, string, boolean]> = [
    ["cita", "Nueva cita online", "Se ha reservado una cita para hoy.", false],
    ["presupuesto", "Presupuesto pendiente", "Un cliente no ha respondido al presupuesto.", false],
    ["resena", "Nueva reseña", "Has recibido una nueva valoración.", false],
    ["estado", "Vehículo listo", "Un vehículo está listo para entrega.", true],
  ];
  notifs.forEach(([type, title, body, read], i) =>
    notificationsRepo.create(t, {
      tenantId: t,
      type,
      title,
      body,
      read,
      createdAt: hoursAgo(i * 5 + 1),
    } as Omit<AppNotification, "id">),
  );
}

// Per-tenant sequential invoice number, scoped to the current year.
function nextNumber(tenantId: string): string {
  const year = new Date().getFullYear();
  const prefix = `F-${year}-`;
  const existing = invoicesRepo.list(tenantId).filter((i) => i.number.startsWith(prefix));
  let max = 0;
  for (const inv of existing) {
    const n = parseInt(inv.number.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

// ---- Tenant datasets -------------------------------------------------------

const BRAKE_WARRANTY = { warrantyMonths: 12, warrantyKm: 20000 };

// Taller García — Madrid (EUR, IVA 21%), Pro.
const GARCIA: TenantSeed = {
  priceFactor: 1,
  accent: "#2F6FED",
  ownerName: "Carlos García",
  tenant: {
    id: "tnt_garcia",
    name: "Taller García",
    slug: "garcia",
    accentColor: "#2F6FED",
    planId: "plan_pro",
    status: "active",
    currency: "EUR",
    taxRate: 0.21,
    legalName: "Talleres García e Hijos S.L.",
    taxId: "B-87654321",
    email: "info@tallergarcia.es",
    phone: "910 234 567",
    googleReviewUrl: "https://g.page/r/taller-garcia-madrid/review",
    businessHours: weekHours("08:30", "19:00", "09:00", "14:00"),
    locations: [
      {
        id: "loc_garcia_1",
        tenantId: "tnt_garcia",
        name: "Madrid Centro",
        address: "C/ Alcalá 120, 28009 Madrid",
        phone: "910 234 567",
      },
    ],
    createdAt: daysAgo(420),
  },
  customers: [
    { name: "Lucía Moreno", phone: "612 345 678", email: "lucia.moreno@email.es" },
    { name: "Javier Castaño", phone: "615 987 321", email: "javier.castano@email.es" },
    { name: "Carmen Ruiz", phone: "699 112 233", email: "carmen.ruiz@email.es" },
    { name: "Diego Herrero", phone: "627 445 889", email: "diego.herrero@email.es" },
    { name: "Marta Gil", phone: "634 778 990", email: "marta.gil@email.es" },
  ],
  vehicles: [
    { make: "Seat", model: "León", year: 2019, plate: "1234 KLM", km: 78400, color: "Gris", customerIdx: 0 },
    { make: "Volkswagen", model: "Golf", year: 2017, plate: "5678 BNP", km: 112300, color: "Blanco", customerIdx: 1 },
    { make: "Renault", model: "Mégane", year: 2020, plate: "9012 RST", km: 54100, color: "Azul", customerIdx: 2 },
    { make: "Peugeot", model: "308", year: 2018, plate: "3456 DGH", km: 89600, color: "Negro", customerIdx: 3 },
    { make: "Toyota", model: "Corolla", year: 2021, plate: "7890 JKL", km: 32000, color: "Gris", customerIdx: 4 },
    { make: "Audi", model: "A3", year: 2019, plate: "2345 MNB", km: 67200, color: "Negro", customerIdx: 0 },
  ],
  orders: [
    {
      vehicleIdx: 0,
      status: "recibido",
      problem: "Ruido al frenar y vibración en el volante",
      checkin: { km: 78400, fuel: 60, damage: true },
    },
    {
      vehicleIdx: 1,
      status: "diagnostico",
      problem: "Testigo de motor encendido",
      checkin: { km: 112300, fuel: 35 },
      inspection: INSP_OK,
    },
    {
      vehicleIdx: 2,
      status: "presupuesto_enviado",
      problem: "Revisión de frenos completa",
      customerMessage: "¿El precio incluye IVA?",
      checkin: { km: 54100, fuel: 80 },
      inspection: INSP_MIXED,
      lines: [
        { type: "labor", description: "Mano de obra — frenos", qty: 2, unitPrice: 45 },
        { type: "part", description: "Pastillas de freno delanteras", qty: 1, unitPrice: 48, ...BRAKE_WARRANTY },
        { type: "part", description: "Discos de freno delanteros", qty: 2, unitPrice: 65, ...BRAKE_WARRANTY },
      ],
    },
    {
      vehicleIdx: 3,
      status: "aprobado",
      problem: "Cambio de embrague por patinamiento",
      checkin: { km: 89600, fuel: 50 },
      inspection: INSP_MIXED,
      lines: [
        { type: "labor", description: "Mano de obra — embrague", qty: 4, unitPrice: 45 },
        { type: "part", description: "Kit de embrague", qty: 1, unitPrice: 210, warrantyMonths: 24 },
      ],
    },
    {
      vehicleIdx: 4,
      status: "en_reparacion",
      problem: "Distribución a los 90.000 km",
      checkin: { km: 32000, fuel: 70 },
      lines: [
        { type: "labor", description: "Mano de obra — distribución", qty: 3, unitPrice: 45 },
        { type: "part", description: "Kit de distribución", qty: 1, unitPrice: 180, warrantyMonths: 24, warrantyKm: 60000 },
      ],
    },
    {
      vehicleIdx: 5,
      status: "listo",
      problem: "Cambio de aceite y filtros",
      checkin: { km: 67200, fuel: 45 },
      lines: [
        { type: "labor", description: "Mano de obra — mantenimiento", qty: 1, unitPrice: 45 },
        { type: "part", description: "Aceite sintético 5W30 (4L)", qty: 4, unitPrice: 10 },
        { type: "part", description: "Filtro de aceite", qty: 1, unitPrice: 12 },
      ],
    },
    {
      vehicleIdx: 0,
      status: "entregado",
      problem: "Sustitución de pastillas y discos",
      checkin: { km: 76000, fuel: 55 },
      inspection: INSP_OK,
      invoiceStatus: "paid",
      review: { rating: 5, comment: "Rápidos y muy honestos. Repetiré sin duda." },
      lines: [
        { type: "labor", description: "Mano de obra — frenos", qty: 2, unitPrice: 45, ...BRAKE_WARRANTY },
        { type: "part", description: "Pastillas de freno delanteras", qty: 1, unitPrice: 48, ...BRAKE_WARRANTY },
      ],
    },
    {
      vehicleIdx: 2,
      status: "entregado",
      problem: "Cambio de batería",
      invoiceStatus: "pending",
      review: { rating: 4 },
      lines: [
        { type: "labor", description: "Mano de obra", qty: 1, unitPrice: 30 },
        { type: "part", description: "Batería 70Ah", qty: 1, unitPrice: 95, warrantyMonths: 24 },
      ],
    },
  ],
  reminders: [
    { vehicleIdx: 0, label: "Cambio de aceite", dueInDays: -8, note: "Cada 15.000 km" },
    { vehicleIdx: 1, label: "Revisión de los 120.000 km", dueKmDelta: -3000 },
    { vehicleIdx: 4, label: "Próxima ITV", dueInDays: 25 },
    { vehicleIdx: 2, label: "Rotación de neumáticos", dueInDays: 40 },
  ],
};

// AutoNorte — A Coruña (EUR, IVA 21%), Básico.
const AUTONORTE: TenantSeed = {
  priceFactor: 1,
  accent: "#0F766E",
  ownerName: "Manuel Rilo",
  tenant: {
    id: "tnt_autonorte",
    name: "AutoNorte",
    slug: "autonorte",
    accentColor: "#0F766E",
    planId: "plan_basico",
    status: "active",
    currency: "EUR",
    taxRate: 0.21,
    legalName: "AutoNorte Reparaciones S.L.U.",
    taxId: "B-15123456",
    email: "contacto@autonorte.es",
    phone: "981 456 789",
    googleReviewUrl: "https://g.page/r/autonorte-coruna/review",
    businessHours: weekHours("09:00", "18:30", "10:00", "13:30"),
    locations: [
      {
        id: "loc_autonorte_1",
        tenantId: "tnt_autonorte",
        name: "A Coruña",
        address: "Av. Finisterre 45, 15004 A Coruña",
        phone: "981 456 789",
      },
    ],
    createdAt: daysAgo(640),
  },
  customers: [
    { name: "Brais Castro", phone: "636 101 202", email: "brais.castro@email.es" },
    { name: "Antía Souto", phone: "639 303 404", email: "antia.souto@email.es" },
    { name: "Noa Pérez", phone: "688 505 606", email: "noa.perez@email.es" },
    { name: "Iago Ferreiro", phone: "655 707 808", email: "iago.ferreiro@email.es" },
  ],
  vehicles: [
    { make: "Citroën", model: "C4", year: 2018, plate: "4521 HBV", km: 95200, color: "Gris", customerIdx: 0 },
    { make: "Ford", model: "Focus", year: 2016, plate: "8834 GLC", km: 134800, color: "Azul", customerIdx: 1 },
    { make: "Dacia", model: "Sandero", year: 2020, plate: "1290 JTR", km: 41300, color: "Blanco", customerIdx: 2 },
    { make: "Opel", model: "Corsa", year: 2019, plate: "6677 KDP", km: 58900, color: "Rojo", customerIdx: 3 },
  ],
  orders: [
    {
      vehicleIdx: 0,
      status: "recibido",
      problem: "Mantenimiento general y revisión",
      checkin: { km: 95200, fuel: 40 },
    },
    {
      vehicleIdx: 1,
      status: "presupuesto_enviado",
      problem: "Ruido en suspensión delantera",
      checkin: { km: 134800, fuel: 25, damage: true },
      inspection: INSP_MIXED,
      lines: [
        { type: "labor", description: "Mano de obra — suspensión", qty: 2, unitPrice: 40 },
        { type: "part", description: "Amortiguadores delanteros (par)", qty: 1, unitPrice: 140, warrantyMonths: 12 },
      ],
    },
    {
      vehicleIdx: 2,
      status: "en_reparacion",
      problem: "Cambio de aceite y filtros",
      checkin: { km: 41300, fuel: 65 },
      lines: [
        { type: "labor", description: "Mano de obra", qty: 1, unitPrice: 40 },
        { type: "part", description: "Aceite sintético 5W30 (4L)", qty: 4, unitPrice: 10 },
        { type: "part", description: "Filtro de aceite", qty: 1, unitPrice: 12 },
      ],
    },
    {
      vehicleIdx: 3,
      status: "entregado",
      problem: "Revisión de frenos y pastillas",
      checkin: { km: 58000, fuel: 50 },
      inspection: INSP_OK,
      invoiceStatus: "paid",
      review: { rating: 5, comment: "Trato cercano y precio justo." },
      lines: [
        { type: "labor", description: "Mano de obra — frenos", qty: 2, unitPrice: 40, ...BRAKE_WARRANTY },
        { type: "part", description: "Pastillas de freno delanteras", qty: 1, unitPrice: 48, ...BRAKE_WARRANTY },
      ],
    },
    {
      vehicleIdx: 0,
      status: "entregado",
      problem: "Cambio de batería",
      invoiceStatus: "pending",
      review: { rating: 3, comment: "Bien, aunque tardaron más de lo previsto." },
      lines: [
        { type: "labor", description: "Mano de obra", qty: 1, unitPrice: 25 },
        { type: "part", description: "Batería 70Ah", qty: 1, unitPrice: 95, warrantyMonths: 24 },
      ],
    },
  ],
  reminders: [
    { vehicleIdx: 1, label: "Revisión de los 135.000 km", dueKmDelta: -200 },
    { vehicleIdx: 0, label: "Cambio de aceite", dueInDays: -3 },
    { vehicleIdx: 2, label: "Próxima ITV", dueInDays: 30 },
  ],
};

// Taller Reyes — CDMX (MXN, IVA 16%), Premium. Prices scaled ~x20.
const REYES: TenantSeed = {
  priceFactor: 20,
  accent: "#B45309",
  ownerName: "Ricardo Reyes",
  tenant: {
    id: "tnt_reyes",
    name: "Taller Reyes",
    slug: "reyes",
    accentColor: "#B45309",
    planId: "plan_premium",
    status: "active",
    currency: "MXN",
    taxRate: 0.16,
    legalName: "Servicio Automotriz Reyes S.A. de C.V.",
    taxId: "SAR240115AB9",
    email: "contacto@tallerreyes.mx",
    phone: "55 1234 5678",
    googleReviewUrl: "https://g.page/r/taller-reyes-cdmx/review",
    businessHours: weekHours("08:00", "19:00", "09:00", "15:00"),
    locations: [
      {
        id: "loc_reyes_1",
        tenantId: "tnt_reyes",
        name: "Ciudad de México",
        address: "Av. Insurgentes Sur 1234, Col. Del Valle, 03100 CDMX",
        phone: "55 1234 5678",
      },
    ],
    createdAt: daysAgo(300),
  },
  customers: [
    { name: "José Luis Hernández", phone: "55 8123 4567", email: "joseluis.hernandez@email.mx" },
    { name: "María Fernanda Cruz", phone: "55 8234 5678", email: "mariafernanda.cruz@email.mx" },
    { name: "Ricardo Mendoza", phone: "55 8345 6789", email: "ricardo.mendoza@email.mx" },
    { name: "Alejandra Ramírez", phone: "55 8456 7890", email: "alejandra.ramirez@email.mx" },
  ],
  vehicles: [
    { make: "Nissan", model: "Versa", year: 2020, plate: "NXP-12-34", km: 62500, color: "Gris", customerIdx: 0 },
    { make: "Chevrolet", model: "Aveo", year: 2019, plate: "MVR-78-90", km: 88200, color: "Blanco", customerIdx: 1 },
    { make: "Volkswagen", model: "Jetta", year: 2021, plate: "PKL-45-67", km: 35400, color: "Negro", customerIdx: 2 },
    { make: "Toyota", model: "Hilux", year: 2018, plate: "NCT-23-45", km: 110600, color: "Plata", customerIdx: 3 },
    { make: "Kia", model: "Rio", year: 2022, plate: "RST-89-01", km: 21800, color: "Rojo", customerIdx: 0 },
  ],
  orders: [
    {
      vehicleIdx: 0,
      status: "recibido",
      problem: "Servicio mayor de los 60.000 km",
      checkin: { km: 62500, fuel: 50 },
    },
    {
      vehicleIdx: 1,
      status: "presupuesto_enviado",
      problem: "Frenos rechinando al frenar",
      customerMessage: "¿Tienen garantía las balatas?",
      checkin: { km: 88200, fuel: 30 },
      inspection: INSP_MIXED,
      lines: [
        { type: "labor", description: "Mano de obra — frenos", qty: 2, unitPrice: 45 },
        { type: "part", description: "Balatas delanteras", qty: 1, unitPrice: 48, ...BRAKE_WARRANTY },
      ],
    },
    {
      vehicleIdx: 2,
      status: "aprobado",
      problem: "Cambio de clutch por desgaste",
      checkin: { km: 35400, fuel: 70, damage: true },
      inspection: INSP_OK,
      lines: [
        { type: "labor", description: "Mano de obra — clutch", qty: 4, unitPrice: 45 },
        { type: "part", description: "Kit de clutch", qty: 1, unitPrice: 210, warrantyMonths: 24 },
      ],
    },
    {
      vehicleIdx: 3,
      status: "en_reparacion",
      problem: "Afinación mayor y cambio de aceite",
      checkin: { km: 110600, fuel: 45 },
      lines: [
        { type: "labor", description: "Mano de obra — afinación", qty: 2, unitPrice: 45 },
        { type: "part", description: "Aceite sintético 5W30 (5L)", qty: 5, unitPrice: 10 },
        { type: "part", description: "Bujías (juego x4)", qty: 1, unitPrice: 32 },
      ],
    },
    {
      vehicleIdx: 4,
      status: "entregado",
      problem: "Cambio de balatas delanteras",
      checkin: { km: 21000, fuel: 60 },
      inspection: INSP_OK,
      invoiceStatus: "paid",
      review: { rating: 5, comment: "Excelente servicio, muy profesionales." },
      lines: [
        { type: "labor", description: "Mano de obra — frenos", qty: 2, unitPrice: 45, ...BRAKE_WARRANTY },
        { type: "part", description: "Balatas delanteras", qty: 1, unitPrice: 48, ...BRAKE_WARRANTY },
      ],
    },
    {
      vehicleIdx: 0,
      status: "entregado",
      problem: "Servicio menor",
      invoiceStatus: "pending",
      review: { rating: 4, comment: "Todo bien." },
      lines: [
        { type: "labor", description: "Mano de obra", qty: 1, unitPrice: 45 },
        { type: "part", description: "Filtro de aceite", qty: 1, unitPrice: 12 },
      ],
    },
  ],
  reminders: [
    { vehicleIdx: 3, label: "Afinación mayor", dueInDays: -10, note: "Cada 20.000 km" },
    { vehicleIdx: 0, label: "Servicio de los 65.000 km", dueKmDelta: -1500 },
    { vehicleIdx: 2, label: "Verificación vehicular", dueInDays: 20 },
  ],
};

// Build a 7-day business-hours array (Mon–Sun). Saturday uses the short range,
// Sunday is closed.
function weekHours(
  open: string,
  close: string,
  satOpen: string,
  satClose: string,
) {
  return [
    { open: true, from: open, to: close }, // Mon
    { open: true, from: open, to: close }, // Tue
    { open: true, from: open, to: close }, // Wed
    { open: true, from: open, to: close }, // Thu
    { open: true, from: open, to: close }, // Fri
    { open: true, from: satOpen, to: satClose }, // Sat
    { open: false, from: "00:00", to: "00:00" }, // Sun
  ];
}

// ---- Entry points ----------------------------------------------------------

export function seedIfEmpty(): void {
  if (typeof window === "undefined") return;
  // Version-aware: when the seed shape changes we wipe & reseed so the demo
  // always reflects the latest data.
  if (readRaw(SEED_FLAG) === SEED_VERSION) return;
  clearAll();
  doSeed();
}

function doSeed(): void {
  PLANS.forEach((p) => plansRepo.create(p));

  // System superadmin (global users collection).
  usersRepo.create({
    tenantId: null,
    name: "Superadmin",
    email: "admin@talleo.app",
    role: "superadmin",
  } as Omit<User, "id">);

  seedTenant(GARCIA);
  seedTenant(AUTONORTE);
  seedTenant(REYES);

  writeRaw(SEED_FLAG, SEED_VERSION);
}

export function resetDemo(): void {
  clearAll();
  doSeed();
}
