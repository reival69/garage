// Talleo — demo seed data. Everything is local and simulated.

import type {
  Appointment,
  Customer,
  Part,
  Plan,
  Service,
  Tenant,
  User,
  Vehicle,
  WorkOrder,
  WorkOrderStatus,
  AppNotification,
} from "@/types";
import {
  appointmentsRepo,
  customersRepo,
  notificationsRepo,
  partsRepo,
  plansRepo,
  servicesRepo,
  tenantsRepo,
  usersRepo,
  vehiclesRepo,
  workOrdersRepo,
} from "./repos";
import { clearAll, readRaw, uid, writeRaw } from "./storage";

const SEED_FLAG = "seeded";

// Tiny base64 placeholder images (kept small to respect the ~5MB quota).
const PHOTO_A =
  "data:image/svg+xml;base64," +
  btoaSafe(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='100%' height='100%' fill='#e4e4e7'/><text x='50%' y='52%' font-family='sans-serif' font-size='14' fill='#71717a' text-anchor='middle'>Recepción</text></svg>`,
  );
const PHOTO_B =
  "data:image/svg+xml;base64," +
  btoaSafe(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='100%' height='100%' fill='#d4d4d8'/><text x='50%' y='52%' font-family='sans-serif' font-size='14' fill='#52525b' text-anchor='middle'>Detalle</text></svg>`,
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

// ---- Static catalogs -------------------------------------------------------

const SERVICE_NAMES: Array<[string, number, number]> = [
  ["Cambio de aceite y filtro", 65, 45],
  ["Revisión de frenos", 90, 60],
  ["Cambio de neumáticos", 50, 40],
  ["Diagnóstico electrónico", 45, 30],
  ["Alineación y equilibrado", 70, 50],
  ["Cambio de batería", 40, 25],
];

const PART_NAMES: Array<[string, number, string]> = [
  ["Filtro de aceite", 12.5, "FO-1024"],
  ["Pastillas de freno delanteras", 48.0, "PF-2048"],
  ["Aceite sintético 5W30 (1L)", 9.9, "AC-5W30"],
  ["Batería 70Ah", 95.0, "BAT-70"],
  ["Neumático 205/55 R16", 78.0, "NE-2055"],
  ["Bujías (juego x4)", 32.0, "BJ-X4"],
];

const FIRST_NAMES = [
  "Lucía",
  "Marcos",
  "Elena",
  "Javier",
  "Carmen",
  "Diego",
  "Sara",
  "Pablo",
];
const LAST_NAMES = [
  "García",
  "Fernández",
  "López",
  "Martín",
  "Sánchez",
  "Romero",
  "Torres",
  "Vidal",
];
const VEHICLES: Array<[string, string, number, string]> = [
  ["Seat", "León", 2019, "1234 KLM"],
  ["Volkswagen", "Golf", 2017, "5678 BNP"],
  ["Renault", "Mégane", 2020, "9012 RST"],
  ["Peugeot", "308", 2018, "3456 DGH"],
  ["Toyota", "Corolla", 2021, "7890 JKL"],
  ["Ford", "Focus", 2016, "2345 MNB"],
  ["Citroën", "C4", 2019, "6789 VCX"],
  ["BMW", "Serie 1", 2020, "1357 ZAQ"],
];

const PIPELINE: WorkOrderStatus[] = [
  "recibido",
  "diagnostico",
  "presupuesto_enviado",
  "aprobado",
  "en_reparacion",
  "listo",
  "entregado",
  "recibido",
  "diagnostico",
  "presupuesto_enviado",
];

const PROBLEMS = [
  "Ruido al frenar y vibración en el volante",
  "Revisión de los 60.000 km",
  "Testigo de motor encendido",
  "Cambio de aceite y filtros",
  "Pérdida de potencia en aceleración",
  "Aire acondicionado no enfría",
  "Cambio de neumáticos delanteros",
  "Ruido en suspensión delantera",
  "Batería se descarga",
  "Mantenimiento general",
];

interface SeedOpts {
  /** Number of customers to create. */
  customers?: number;
  /** Number of vehicles to create. */
  vehicles?: number;
  /** Pipeline (one work order per entry). */
  pipeline?: WorkOrderStatus[];
  /** Multiplier applied to catalog & quote prices (e.g. ~20 for MXN). */
  priceFactor?: number;
}

function seedTenant(tenant: Tenant, opts: SeedOpts = {}): void {
  const customerCount = opts.customers ?? 6;
  const vehicleCount = opts.vehicles ?? 7;
  const pipeline = opts.pipeline ?? PIPELINE;
  const f = opts.priceFactor ?? 1;

  tenantsRepo.create(tenant);
  const t = tenant.id;
  const locationId = tenant.locations[0].id;

  // Users
  const owner = usersRepo.create({
    tenantId: t,
    name: "Owner " + tenant.name,
    email: `owner@${tenant.slug}.es`,
    role: "owner",
    locationId,
  } as Omit<User, "id">);
  usersRepo.create({
    tenantId: t,
    name: "Recepción",
    email: `recepcion@${tenant.slug}.es`,
    role: "staff",
    locationId,
  } as Omit<User, "id">);
  const mechanic = usersRepo.create({
    tenantId: t,
    name: "Mecánico",
    email: `taller@${tenant.slug}.es`,
    role: "mechanic",
    locationId,
  } as Omit<User, "id">);

  // Services & parts (prices scaled by the tenant currency factor)
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
  const customers: Customer[] = [];
  const count = customerCount;
  for (let i = 0; i < count; i++) {
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
    const c = customersRepo.create(t, {
      tenantId: t,
      name,
      phone: `6${(10000000 + i * 137).toString().slice(0, 8)}`,
      email: `${name.split(" ")[0].toLowerCase()}@email.es`,
      createdAt: hoursAgo(200 + i * 12),
    } as Omit<Customer, "id">);
    customers.push(c);
  }

  // Vehicles (one or two per customer-ish, 7 total)
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < vehicleCount; i++) {
    const [make, model, year] = VEHICLES[i % VEHICLES.length];
    const owner_c = customers[i % customers.length];
    const v = vehiclesRepo.create(t, {
      tenantId: t,
      customerId: owner_c.id,
      plate: `${1000 + i * 111} ${["KLM", "BNP", "RST", "DGH", "JKL", "MNB", "VCX"][i]}`,
      make,
      model,
      year,
      km: 30000 + i * 9000,
      color: ["Gris", "Blanco", "Negro", "Azul"][i % 4],
    } as Omit<Vehicle, "id">);
    vehicles.push(v);
  }

  // Work orders across the whole pipeline
  PIPELINE.forEach((status, i) => {
    const v = vehicles[i % vehicles.length];
    const hasQuote =
      status !== "recibido" && status !== "diagnostico";
    const items = hasQuote
      ? [
          {
            id: uid("qi"),
            type: "labor" as const,
            description: "Mano de obra",
            qty: 2,
            unitPrice: 45,
            approval:
              status === "aprobado" ||
              status === "en_reparacion" ||
              status === "listo" ||
              status === "entregado"
                ? ("approved" as const)
                : ("pending" as const),
          },
          {
            id: uid("qi"),
            type: "part" as const,
            description: "Pastillas de freno delanteras",
            qty: 1,
            unitPrice: 48,
            approval:
              status === "aprobado" ||
              status === "en_reparacion" ||
              status === "listo" ||
              status === "entregado"
                ? ("approved" as const)
                : ("pending" as const),
          },
        ]
      : [];
    workOrdersRepo.create(t, {
      tenantId: t,
      locationId,
      customerId: v.customerId,
      vehicleId: v.id,
      mechanicId: mechanic.id,
      status,
      problemDescription: PROBLEMS[i % PROBLEMS.length],
      internalNotes: "Cliente avisado por teléfono.",
      accessCode: code6(),
      items,
      photos: [
        {
          id: uid("ph"),
          url: PHOTO_A,
          label: "recepcion",
          createdAt: hoursAgo(48 - i),
        },
        {
          id: uid("ph"),
          url: PHOTO_B,
          label: "detalle",
          createdAt: hoursAgo(40 - i),
        },
      ],
      messages: [
        {
          id: uid("m"),
          from: "shop",
          text: "Hemos recibido su vehículo, le mantendremos informado.",
          createdAt: hoursAgo(46 - i),
        },
        ...(status === "presupuesto_enviado"
          ? [
              {
                id: uid("m"),
                from: "customer" as const,
                text: "¿El precio incluye IVA?",
                createdAt: hoursAgo(20),
              },
            ]
          : []),
      ],
      estimatedReadyAt: daysFromNow((i % 3) + 1, 18),
      createdAt: hoursAgo(50 - i * 2),
      updatedAt: hoursAgo(2 + i),
    } as Omit<WorkOrder, "id">);
  });

  // Appointments — today and upcoming
  const appts: Array<[number, number, Appointment["status"]]> = [
    [0, 9, "confirmada"],
    [0, 12, "programada"],
    [0, 16, "en_taller"],
    [1, 10, "programada"],
    [2, 11, "confirmada"],
  ];
  appts.forEach(([d, h, status], i) => {
    const v = vehicles[i % vehicles.length];
    appointmentsRepo.create(t, {
      tenantId: t,
      locationId,
      customerId: v.customerId,
      vehicleId: v.id,
      serviceIds: [],
      scheduledAt: daysFromNow(d, h),
      status,
      source: i % 2 === 0 ? "online" : "manual",
    } as Omit<Appointment, "id">);
  });

  // Notifications
  const notifs: Array<[AppNotification["type"], string, string]> = [
    ["cita", "Nueva cita online", "Se ha reservado una cita para mañana."],
    ["presupuesto", "Presupuesto pendiente", "Un cliente no ha respondido al presupuesto."],
    ["estado", "Vehículo listo", "Un vehículo está listo para entrega."],
  ];
  notifs.forEach(([type, title, body], i) =>
    notificationsRepo.create(t, {
      tenantId: t,
      type,
      title,
      body,
      read: i === 2,
      createdAt: hoursAgo(i * 5 + 1),
    } as Omit<AppNotification, "id">),
  );

  void owner;
}

export function seedIfEmpty(): void {
  if (typeof window === "undefined") return;
  if (readRaw(SEED_FLAG) === "1") return;
  doSeed();
}

function doSeed(): void {
  PLANS.forEach((p) => plansRepo.create(p));

  // System superadmin (global users collection)
  usersRepo.create({
    tenantId: null,
    name: "Superadmin",
    email: "admin@talleo.app",
    role: "superadmin",
  } as Omit<User, "id">);

  seedTenant({
    id: "tnt_garcia",
    name: "Taller García",
    slug: "garcia",
    accentColor: "#2F6FED",
    planId: "plan_pro",
    status: "active",
    currency: "EUR",
    taxRate: 0.21,
    locations: [
      {
        id: "loc_garcia_1",
        tenantId: "tnt_garcia",
        name: "Madrid Centro",
        address: "C/ Alcalá 120, Madrid",
        phone: "910 000 111",
      },
    ],
    createdAt: hoursAgo(24 * 60),
  });

  seedTenant({
    id: "tnt_autonorte",
    name: "AutoNorte",
    slug: "autonorte",
    accentColor: "#0F766E",
    planId: "plan_premium",
    status: "active",
    currency: "EUR",
    taxRate: 0.21,
    locations: [
      {
        id: "loc_autonorte_1",
        tenantId: "tnt_autonorte",
        name: "A Coruña",
        address: "Av. Finisterre 45, A Coruña",
        phone: "981 000 222",
      },
    ],
    createdAt: hoursAgo(24 * 90),
  });

  writeRaw(SEED_FLAG, "1");
}

export function resetDemo(): void {
  clearAll();
  doSeed();
}
