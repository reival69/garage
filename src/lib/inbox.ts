// Garage — Mensajes / bandeja de conversaciones. Each conversation is the
// message thread of a work order (OrderMessage, bidirectional shop↔customer).
// These helpers turn the orders into a WhatsApp-style inbox view. Everything is
// local & simulated (no backend), data accessed via repos.

import type { Customer, OrderMessage, Vehicle, WorkOrder } from "@/types";
import { customersRepo, vehiclesRepo, workOrdersRepo } from "@/lib/db";

export interface Conversation {
  order: WorkOrder;
  customer?: Customer;
  vehicle?: Vehicle;
  lastMessage: OrderMessage;
  /** Unread = customer messages (from: 'customer') with read falsy. */
  unread: number;
  /** ISO of the last activity (last message createdAt). */
  lastActivity: string;
}

/** Is a message unread by the shop? (customer message not yet read). */
function isUnreadByShop(m: OrderMessage): boolean {
  return m.from === "customer" && !m.read;
}

/**
 * Conversations for a tenant: orders with ≥1 message, each enriched with the
 * customer/vehicle, last message and unread count, sorted by last activity desc.
 */
export function listConversations(tenantId: string): Conversation[] {
  const orders = workOrdersRepo.list(tenantId);
  const conversations: Conversation[] = [];

  for (const order of orders) {
    if (!order.messages || order.messages.length === 0) continue;
    const sorted = [...order.messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const lastMessage = sorted[sorted.length - 1];
    const unread = order.messages.filter(isUnreadByShop).length;
    conversations.push({
      order,
      customer: customersRepo.getById(tenantId, order.customerId),
      vehicle: vehiclesRepo.getById(tenantId, order.vehicleId),
      lastMessage,
      unread,
      lastActivity: lastMessage.createdAt,
    });
  }

  return conversations.sort(
    (a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
  );
}

/** Mark every customer message of an order as read by the shop. */
export function markConversationRead(
  tenantId: string,
  orderId: string,
): WorkOrder | undefined {
  const order = workOrdersRepo.getById(tenantId, orderId);
  if (!order) return undefined;
  let changed = false;
  const messages = order.messages.map((m) => {
    if (isUnreadByShop(m)) {
      changed = true;
      return { ...m, read: true };
    }
    return m;
  });
  if (!changed) return order;
  return workOrdersRepo.update(tenantId, orderId, { messages });
}

/** Total unread customer messages across all conversations of a tenant. */
export function unreadMessagesCount(tenantId: string): number {
  return workOrdersRepo
    .list(tenantId)
    .reduce(
      (sum, order) =>
        sum + (order.messages?.filter(isUnreadByShop).length ?? 0),
      0,
    );
}
