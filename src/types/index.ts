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
}

export interface User {
  id: string;
  tenantId: string | null; // null = system superadmin
  name: string;
  email: string;
  role: Role;
  locationId?: string;
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

export interface Vehicle {
  id: string;
  tenantId: string;
  customerId: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  km: number;
  vin?: string;
  color?: string;
  notes?: string;
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
}

export interface AppNotification {
  id: string;
  tenantId: string;
  type: "cita" | "presupuesto" | "estado" | "recordatorio";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
