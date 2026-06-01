// Talleo — Domain model types.
// Identifiers and type names in English; product copy lives in the UI in Spanish.

export type Role = "superadmin" | "owner" | "staff" | "mechanic";
export type PlanTier = "basico" | "pro" | "premium";

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  priceMonthly: number;
  limits: { maxOrders: number; maxUsers: number; maxPhotosPerOrder: number };
}

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  phone?: string;
}

/** Opening hours for a single weekday (index 0 = Monday … 6 = Sunday). */
export interface BusinessDay {
  open: boolean;
  from: string; // "09:00"
  to: string; // "18:00"
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  accentColor: string; // overrides --talleo-accent for this shop
  planId: string;
  status: "active" | "suspended";
  currency: string; // e.g. 'EUR'
  taxRate: number; // e.g. 0.21
  locations: Location[];
  createdAt: string;
  // Configuration (set from /app/configuracion). All optional.
  legalName?: string; // razón social — used on invoices
  taxId?: string; // NIF / CIF / RFC — used on invoices
  email?: string;
  phone?: string;
  logoUrl?: string; // base64 image; falls back to the "Talleo" wordmark
  businessHours?: BusinessDay[]; // length 7, Monday → Sunday
  googleReviewUrl?: string; // public Google review link offered to happy customers
  // Optional modules enabled/disabled per shop (Configuración → Módulos).
  // Missing key = enabled by default. Core modules are always on.
  enabledModules?: Partial<Record<string, boolean>>;
}

export interface User {
  id: string;
  tenantId: string | null; // null = system superadmin
  name: string;
  email: string;
  role: Role;
  locationId?: string;
  active?: boolean; // default true; inactive users cannot log in or be assigned
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export type FuelType =
  | "gasolina"
  | "diesel"
  | "electrico"
  | "hibrido"
  | "glp"
  | "otro";

export type Transmission = "manual" | "automatico";

export interface Vehicle {
  id: string;
  tenantId: string;
  customerId: string;
  accessCode: string; // stable 6-char public code for the permanent cartilla (/v/:code)
  plate: string;
  make: string;
  model: string;
  year: number;
  km: number;
  vin?: string;
  color?: string;
  notes?: string;
  // Extended technical sheet (all optional).
  fuelType?: FuelType;
  transmission?: Transmission;
  displacementCc?: number; // engine displacement in cc
  powerHp?: number; // power in horsepower
  // Vehicle-level photo gallery, independent from work-order photos.
  photos?: Photo[];
  coverPhotoId?: string; // id of the photo shown as the cartilla cover
  // Documents and expiry dates (ITV, insurance, road tax, …).
  documents?: VehicleDocument[];
}

export type VehicleDocumentType =
  | "itv"
  | "seguro"
  | "impuesto"
  | "permiso"
  | "ficha_tecnica"
  | "otro";

export interface VehicleDocument {
  id: string;
  tenantId: string;
  vehicleId: string;
  type: VehicleDocumentType;
  label?: string; // custom name when type === "otro"
  expiryDate?: string; // ISO date — drives the vigente/por vencer/vencido badge
  note?: string;
  fileBase64?: string; // compressed image of the document (optional)
  fileName?: string;
  notified?: boolean; // true once it emitted its expiry notification
  createdAt: string;
}

export type WorkOrderStatus =
  | "recibido"
  | "diagnostico"
  | "presupuesto_enviado"
  | "aprobado"
  | "en_reparacion"
  | "listo"
  | "entregado"
  | "cancelado";

export interface QuoteItem {
  id: string;
  type: "labor" | "part";
  description: string;
  qty: number;
  unitPrice: number;
  approval: "pending" | "approved" | "rejected";
  warrantyMonths?: number; // optional warranty in months for this line
  warrantyKm?: number; // optional warranty in kilometres for this line
  partId?: string; // links a "part" line to its catalog Part, to decrement stock
}

export interface Photo {
  id: string;
  url: string; // base64
  label: "recepcion" | "antes" | "despues" | "detalle";
  note?: string;
  createdAt: string;
}

export interface BodyDamageMark {
  x: number;
  y: number;
  note?: string;
}

export interface CheckIn {
  km: number;
  fuelLevel: number; // 0-100
  bodyDamage: BodyDamageMark[];
  customerSignature?: string; // base64 signature
  createdAt: string;
}

export interface InspectionItem {
  id: string;
  name: string; // e.g. 'Pastillas de freno'
  status: "ok" | "atencion" | "critico";
  note?: string;
  photoId?: string;
}

export interface Inspection {
  items: InspectionItem[];
  createdAt: string;
}

export interface OrderMessage {
  id: string;
  from: "shop" | "customer";
  text: string;
  createdAt: string;
  // Whether the recipient has read this message. In the shop inbox, "unread"
  // means customer messages (from: 'customer') with read falsy.
  read?: boolean;
}

export interface WorkOrder {
  id: string;
  tenantId: string;
  locationId: string;
  customerId: string;
  vehicleId: string;
  mechanicId?: string;
  status: WorkOrderStatus;
  problemDescription: string;
  internalNotes?: string; // NOT visible to the customer
  accessCode: string; // 6-char code for the guest view
  items: QuoteItem[];
  photos: Photo[];
  checkIn?: CheckIn;
  inspection?: Inspection;
  messages: OrderMessage[];
  // Customer's signed decision on the quote (approval view).
  quoteApproval?: { signature: string; decidedAt: string };
  estimatedReadyAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  workOrderId: string;
  number: string;
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "pending" | "paid" | "partial";
  createdAt: string;
}

export type AppointmentStatus =
  | "programada"
  | "confirmada"
  | "en_taller"
  | "completada"
  | "no_show";

export interface Appointment {
  id: string;
  tenantId: string;
  locationId: string;
  customerId?: string;
  vehicleId?: string;
  serviceIds: string[];
  scheduledAt: string;
  status: AppointmentStatus;
  source: "manual" | "online";
  notes?: string;
  // Set when the car is received and a work order is created from this appointment.
  workOrderId?: string;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  basePrice: number;
  estimatedMinutes: number;
}

export interface Part {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  sku?: string;
  // Inventory (Stock module). All optional so existing catalog data is valid.
  stockQty?: number; // current units on hand
  minStock?: number; // minimum desired units; at or below → "bajo stock"
  location?: string; // warehouse location, e.g. "Estante A-3"
  lowStockNotified?: boolean; // true once it emitted its low-stock notification
}

export interface AppNotification {
  id: string;
  tenantId: string;
  type: "cita" | "presupuesto" | "estado" | "recordatorio" | "resena";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string; // destination route, e.g. "/app/ordenes/abc"
}

export interface Review {
  id: string;
  tenantId: string;
  orderId: string;
  customerId: string;
  vehicleId: string;
  rating: number; // 1–5
  comment?: string;
  createdAt: string;
}

export interface MaintenanceReminder {
  id: string;
  tenantId: string;
  vehicleId: string;
  customerId: string;
  label: string; // e.g. "Cambio de aceite"
  dueDate?: string; // ISO date — due when reached
  dueKm?: number; // odometer target — due when vehicle.km >= dueKm
  note?: string;
  status: "pending" | "done" | "dismissed";
  notified?: boolean; // true once it has emitted its overdue notification
  createdAt: string;
}
