// Talleo — Agentes. A simulated AI assistant that can attend the message inbox
// of a shop. No real LLM, no backend: the agent answers by local intent rules
// (trigger → response). In production `instructions` would drive an LLM. The
// Meta WhatsApp connection is a visual placeholder. Everything is local &
// simulated — all data access goes through repos.

import type { Agent, AgentReplyRule, Tenant, WorkOrder } from "@/types";
import { agentsRepo, tenantsRepo, uid, workOrdersRepo } from "@/lib/db";

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

export const SCHEDULE_LABELS: Record<Agent["schedule"], string> = {
  always: "Siempre",
  after_hours: "Solo fuera de horario",
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

// ---- Schedule --------------------------------------------------------------

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

/**
 * The agent that should attend the inbox right now: the first active agent
 * whose schedule applies (always, or after_hours when the shop is closed).
 */
export function activeAgent(tenantId: string): Agent | undefined {
  const tenant = tenantsRepo.getById(tenantId);
  const open = isShopOpenNow(tenant);
  return listAgents(tenantId).find(
    (a) =>
      a.status === "active" &&
      (a.schedule === "always" || (a.schedule === "after_hours" && !open)),
  );
}

// ---- Reply engine ----------------------------------------------------------

export interface AgentReplyResult {
  /** The text the agent will send (may be empty if no match and no handoff). */
  text: string;
  /** True when no intent matched → the thread should hand off to a human. */
  handoff: boolean;
  /** True when an intent rule matched the message. */
  matched: boolean;
}

/**
 * Compute the agent's reply to a customer message. Looks for the first intent
 * whose (comma-separated) trigger keywords appear in the text. If none match
 * and a handoff message exists, returns it and flags a handoff.
 */
export function agentReply(agent: Agent, text: string): AgentReplyResult {
  const q = text.toLowerCase();
  for (const rule of agent.replies) {
    const triggers = rule.trigger
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (triggers.length && triggers.some((t) => q.includes(t))) {
      return { text: rule.response, handoff: false, matched: true };
    }
  }
  return { text: agent.handoffMessage ?? "", handoff: true, matched: false };
}

/**
 * Run the active agent against an incoming customer message on a conversation.
 * Appends the agent's reply as a shop message (sentByAgent: true). If it could
 * not match an intent, marks the conversation as handled by a human.
 * Returns the updated order (or the original if no active agent).
 */
export function runAgentOnIncoming(
  tenantId: string,
  order: WorkOrder,
  customerText: string,
): WorkOrder | undefined {
  const agent = activeAgent(tenantId);
  if (!agent) return order;
  const result = agentReply(agent, customerText);
  const now = new Date().toISOString();
  const messages = [...order.messages];
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
