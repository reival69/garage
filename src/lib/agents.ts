// Garage — Agentes. A simulated AI assistant that can attend the message inbox
// of a shop. No real LLM, no backend: the agent answers by local intent rules
// (trigger → response) plus a few "smart" intents that read tenant data, and a
// keyword search over its context documents. In production `instructions` would
// drive an LLM. The Meta WhatsApp connection is a visual placeholder.
// Everything is local & simulated — all data access goes through repos.

import type {
  Agent,
  AgentDataAccess,
  AgentReplyRule,
  AgentResponseHour,
  Tenant,
  WorkOrder,
} from "@/types";
import {
  agentsRepo,
  appointmentsRepo,
  customersRepo,
  servicesRepo,
  tenantsRepo,
  uid,
  vehiclesRepo,
  workOrdersRepo,
} from "@/lib/db";
import { STATUS_LABELS } from "@/lib/orders";
import { formatCurrency, formatDateTime } from "@/lib/format";

// Available tones for the agent's voice (selector in the form).
export const AGENT_TONES: Array<{ value: string; label: string }> = [
  { value: "cercano", label: "Cercano" },
  { value: "profesional", label: "Profesional" },
  { value: "formal", label: "Formal" },
  { value: "directo", label: "Directo" },
];

export const TONE_LABELS: Record<string, string> = Object.fromEntries(
  AGENT_TONES.map((t) => [t.value, t.label]),
);

// ---- Timezones & schedule defaults ----------------------------------------

// A short, curated IANA timezone list for the selector (local & simulated).
export const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: "Europe/Madrid", label: "Europe/Madrid (España)" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon (Portugal)" },
  { value: "Europe/London", label: "Europe/London (Reino Unido)" },
  { value: "Atlantic/Canary", label: "Atlantic/Canary (Canarias)" },
  { value: "America/Mexico_City", label: "America/Mexico_City (México)" },
  { value: "America/Bogota", label: "America/Bogota (Colombia)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (Argentina)" },
  { value: "America/Santiago", label: "America/Santiago (Chile)" },
  { value: "America/Lima", label: "America/Lima (Perú)" },
  { value: "America/New_York", label: "America/New_York (EE. UU. Este)" },
];

export const DEFAULT_TIMEZONE = "Europe/Madrid";

// Default timezone derived from the tenant's currency (best-effort).
export function defaultTimezoneFor(tenant?: Tenant | null): string {
  switch (tenant?.currency) {
    case "MXN":
      return "America/Mexico_City";
    case "USD":
      return "America/New_York";
    default:
      return DEFAULT_TIMEZONE;
  }
}

export const WEEKDAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

// A sensible weekly default: Mon–Fri 09:00–18:00, Sat 10:00–14:00, Sun off.
export function defaultResponseHours(): AgentResponseHour[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    enabled: day < 5,
    from: day === 5 ? "10:00" : "09:00",
    to: day === 5 ? "14:00" : "18:00",
  }));
}

export function defaultDataAccess(): AgentDataAccess {
  return {
    vehiculos: true,
    presupuestos: true,
    servicios: true,
    agenda: true,
    ordenes: true,
    facturas: false,
  };
}

export const DATA_ACCESS_LABELS: Record<keyof AgentDataAccess, string> = {
  vehiculos: "Vehículos",
  presupuestos: "Presupuestos",
  servicios: "Servicios",
  agenda: "Agenda",
  ordenes: "Órdenes",
  facturas: "Facturas",
};

// ---- CRUD ------------------------------------------------------------------

export function listAgents(tenantId: string): Agent[] {
  return agentsRepo
    .list(tenantId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getAgent(tenantId: string, id: string): Agent | undefined {
  return agentsRepo.getById(tenantId, id);
}

export type AgentInput = Omit<Agent, "id" | "tenantId" | "createdAt">;

export function createAgent(tenantId: string, input: AgentInput): Agent {
  return agentsRepo.create(tenantId, {
    tenantId,
    createdAt: new Date().toISOString(),
    ...input,
  } as Omit<Agent, "id">);
}

export function updateAgent(
  tenantId: string,
  id: string,
  patch: Partial<Agent>,
): Agent | undefined {
  return agentsRepo.update(tenantId, id, patch);
}

export function removeAgent(tenantId: string, id: string): void {
  agentsRepo.remove(tenantId, id);
}

export function toggleAgentStatus(
  tenantId: string,
  id: string,
): Agent | undefined {
  const agent = agentsRepo.getById(tenantId, id);
  if (!agent) return undefined;
  return agentsRepo.update(tenantId, id, {
    status: agent.status === "active" ? "paused" : "active",
  });
}

export function newReplyRule(): AgentReplyRule {
  return { id: uid("rule"), trigger: "", response: "" };
}

export function newContextDocId(): string {
  return uid("doc");
}

// ---- Schedule + timezone ---------------------------------------------------

/** Is the shop currently within its configured business hours? */
export function isShopOpenNow(tenant?: Tenant | null): boolean {
  if (!tenant?.businessHours || tenant.businessHours.length !== 7) return true;
  const now = new Date();
  // businessHours index 0 = Monday … 6 = Sunday; JS getDay() 0 = Sunday.
  const idx = (now.getDay() + 6) % 7;
  const day = tenant.businessHours[idx];
  if (!day || !day.open) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = day.from.split(":").map(Number);
  const [th, tm] = day.to.split(":").map(Number);
  return cur >= fh * 60 + fm && cur <= th * 60 + tm;
}

// Current weekday (0 = Monday) + minutes-of-day in the given IANA timezone.
function nowInZone(timezone?: string): { day: number; minutes: number } {
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const map: Record<string, number> = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };
    return { day: map[wd] ?? 0, minutes: (hour % 24) * 60 + minute };
  } catch {
    const now = new Date();
    return { day: (now.getDay() + 6) % 7, minutes: now.getHours() * 60 + now.getMinutes() };
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Is the agent within its response hours right now (in its own timezone)? */
export function isAgentWithinHours(agent: Agent): boolean {
  if (agent.available247) return true;
  const hours = agent.responseHours;
  if (!hours || hours.length === 0) return true; // no schedule → always on
  const { day, minutes } = nowInZone(agent.timezone);
  const slot = hours.find((h) => h.day === day);
  if (!slot || !slot.enabled) return false;
  return minutes >= toMinutes(slot.from) && minutes <= toMinutes(slot.to);
}

/** The first active agent that should attend the inbox. */
export function activeAgent(tenantId: string): Agent | undefined {
  return listAgents(tenantId).find((a) => a.status === "active");
}

// ---- Reply engine ----------------------------------------------------------

export interface AgentReplyResult {
  /** The text the agent will send (may be empty if no match and no handoff). */
  text: string;
  /** True when no intent matched → the thread should hand off to a human. */
  handoff: boolean;
  /** True when an intent rule (manual, smart or doc) matched the message. */
  matched: boolean;
  /** Where the match came from, for badges/debugging. */
  source?: "manual" | "smart" | "doc" | "handoff";
}

export interface AgentReplyContext {
  tenantId: string;
  order?: WorkOrder | null;
}

function access(agent: Agent): AgentDataAccess {
  return agent.dataAccess ?? defaultDataAccess();
}

// Smart intents that read tenant data according to the agent's dataAccess.
function smartReply(
  agent: Agent,
  q: string,
  ctx: AgentReplyContext,
): AgentReplyResult | null {
  const da = access(agent);
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));

  // Order / car status → reads the thread's work order.
  if (
    (da.ordenes || da.vehiculos) &&
    ctx.order &&
    has("estado", "listo", "orden", "coche", "vehículo", "vehiculo", "reparación", "reparacion", "cuándo", "cuando", "terminado")
  ) {
    const o = ctx.order;
    let veh = "";
    if (da.vehiculos) {
      const v = vehiclesRepo.getById(ctx.tenantId, o.vehicleId);
      if (v) veh = ` (${v.make} ${v.model}${v.plate ? `, ${v.plate.toUpperCase()}` : ""})`;
    }
    const label = STATUS_LABELS[o.status] ?? o.status;
    const ready = o.estimatedReadyAt
      ? ` Fecha estimada de entrega: ${formatDateTime(o.estimatedReadyAt)}.`
      : "";
    return {
      text: `El estado actual de tu vehículo${veh} es: ${label}.${ready}`,
      handoff: false,
      matched: true,
      source: "smart",
    };
  }

  // Next appointment → reads the agenda.
  if (da.agenda && has("cita", "agenda", "próxima", "proxima", "reserva", "hora")) {
    const tenant = tenantsRepo.getById(ctx.tenantId);
    const currency = tenant?.currency ?? "EUR";
    const customerId = ctx.order?.customerId;
    const now = Date.now();
    const upcoming = appointmentsRepo
      .list(ctx.tenantId)
      .filter(
        (a) =>
          new Date(a.scheduledAt).getTime() >= now &&
          a.status !== "no_show" &&
          (!customerId || a.customerId === customerId),
      )
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    void currency;
    if (upcoming.length) {
      const next = upcoming[0];
      let who = "";
      if (next.customerId) {
        const c = customersRepo.getById(ctx.tenantId, next.customerId);
        if (c) who = ` a nombre de ${c.name}`;
      }
      return {
        text: `Tu próxima cita${who} es el ${formatDateTime(next.scheduledAt)}.`,
        handoff: false,
        matched: true,
        source: "smart",
      };
    }
    return {
      text: "No encuentro citas próximas. ¿Quieres que te ayude a reservar una?",
      handoff: false,
      matched: true,
      source: "smart",
    };
  }

  // Service price → reads the catalog.
  if (da.servicios && has("precio", "cuánto", "cuanto", "coste", "cuesta", "servicio", "tarifa")) {
    const tenant = tenantsRepo.getById(ctx.tenantId);
    const currency = tenant?.currency ?? "EUR";
    const services = servicesRepo.list(ctx.tenantId);
    // Try to match a specific service name mentioned in the message.
    const named = services.find((s) =>
      q.includes(s.name.toLowerCase().split(" ")[0]),
    );
    if (named) {
      return {
        text: `El precio de «${named.name}» es ${formatCurrency(named.basePrice, currency)} (orientativo).`,
        handoff: false,
        matched: true,
        source: "smart",
      };
    }
    if (services.length) {
      const sample = services
        .slice(0, 3)
        .map((s) => `${s.name}: ${formatCurrency(s.basePrice, currency)}`)
        .join(" · ");
      return {
        text: `Algunos de nuestros servicios: ${sample}. Dime cuál te interesa y te detallo el presupuesto.`,
        handoff: false,
        matched: true,
        source: "smart",
      };
    }
  }

  return null;
}

// Keyword search over the agent's context documents (simple, not AI).
function docReply(agent: Agent, q: string): AgentReplyResult | null {
  const docs = (agent.contextDocs ?? []).filter((d) => d.text && d.text.trim());
  const words = q.split(/\W+/).filter((w) => w.length >= 4);
  if (!words.length) return null;
  for (const doc of docs) {
    const text = doc.text as string;
    const lower = text.toLowerCase();
    const hit = words.find((w) => lower.includes(w));
    if (!hit) continue;
    // Return a short fragment around the first matching keyword.
    const idx = lower.indexOf(hit);
    const start = Math.max(0, idx - 80);
    const end = Math.min(text.length, idx + 200);
    let fragment = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) fragment = "…" + fragment;
    if (end < text.length) fragment = fragment + "…";
    return {
      text: `Según «${doc.name}»: ${fragment}`,
      handoff: false,
      matched: true,
      source: "doc",
    };
  }
  return null;
}

/**
 * Compute the agent's reply to a customer message. Order of resolution:
 * 1) user-defined intent rules, 2) smart intents that read tenant data,
 * 3) keyword search over context docs, 4) handoff message.
 */
export function agentReply(
  agent: Agent,
  text: string,
  ctx?: AgentReplyContext,
): AgentReplyResult {
  const q = text.toLowerCase();

  // 1) Manual intents (user-defined) take priority.
  for (const rule of agent.replies) {
    const triggers = rule.trigger
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (triggers.length && triggers.some((t) => q.includes(t))) {
      return { text: rule.response, handoff: false, matched: true, source: "manual" };
    }
  }

  // 2) Smart intents (only when we have context).
  if (ctx) {
    const smart = smartReply(agent, q, ctx);
    if (smart) return smart;
  }

  // 3) Context documents.
  const doc = docReply(agent, q);
  if (doc) return doc;

  // 4) Handoff.
  return {
    text: agent.handoffMessage ?? "",
    handoff: true,
    matched: false,
    source: "handoff",
  };
}

/**
 * Run the active agent against an incoming customer message on a conversation.
 * Honors the agent's response hours/timezone: outside hours it sends the
 * off-hours message (if any) or hands off to a human. Appends the agent's reply
 * as a shop message (sentByAgent: true). Returns the updated order.
 */
export function runAgentOnIncoming(
  tenantId: string,
  order: WorkOrder,
  customerText: string,
): WorkOrder | undefined {
  const agent = activeAgent(tenantId);
  if (!agent) return order;
  const now = new Date().toISOString();
  const messages = [...order.messages];

  // Outside response hours: off-hours message or straight handoff.
  if (!isAgentWithinHours(agent)) {
    const patch: Partial<WorkOrder> = { updatedAt: now };
    if (agent.offHoursMessage && agent.offHoursMessage.trim()) {
      messages.push({
        id: uid("m"),
        from: "shop" as const,
        text: agent.offHoursMessage,
        createdAt: now,
        read: true,
        sentByAgent: true,
      });
      patch.messages = messages;
    }
    patch.handledBy = "human";
    return workOrdersRepo.update(tenantId, order.id, patch);
  }

  const result = agentReply(agent, customerText, { tenantId, order });
  if (result.text.trim()) {
    messages.push({
      id: uid("m"),
      from: "shop" as const,
      text: result.text,
      createdAt: now,
      read: true,
      sentByAgent: true,
    });
  }
  const patch: Partial<WorkOrder> = { messages, updatedAt: now };
  if (result.handoff) patch.handledBy = "human";
  return workOrdersRepo.update(tenantId, order.id, patch);
}

// ---- Stats -----------------------------------------------------------------

export interface AgentStats {
  conversations: number; // orders with ≥1 agent message
  messages: number; // total messages sent by an agent
}

/** Simulated stats for a tenant, derived from sentByAgent messages. */
export function agentStats(tenantId: string): AgentStats {
  let conversations = 0;
  let messages = 0;
  for (const order of workOrdersRepo.list(tenantId)) {
    const sent = (order.messages ?? []).filter((m) => m.sentByAgent).length;
    if (sent > 0) conversations++;
    messages += sent;
  }
  return { conversations, messages };
}
