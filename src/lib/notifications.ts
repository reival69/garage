// Talleo — notifications domain logic. Centralizes the creation and reading of
// AppNotification records so every part of the app emits notifications the same
// way (with an optional `link` back to the source entity). All data access goes
// through notificationsRepo. Everything is local & simulated.

import type { AppNotification } from "@/types";
import { notificationsRepo } from "@/lib/db";

interface NotifyInput {
  type: AppNotification["type"];
  title: string;
  body: string;
  link?: string;
}

/** Central creator — every notification in the app should go through here. */
export function notify(
  tenantId: string,
  input: NotifyInput,
): AppNotification {
  return notificationsRepo.create(tenantId, {
    tenantId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    read: false,
    createdAt: new Date().toISOString(),
  } as Omit<AppNotification, "id">);
}

/** Notifications for a tenant, newest first. */
export function listNotifications(tenantId: string): AppNotification[] {
  return notificationsRepo
    .list(tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Number of unread notifications for a tenant. */
export function unreadCount(tenantId: string): number {
  return notificationsRepo.list(tenantId).filter((n) => !n.read).length;
}

/** Mark a single notification as read. */
export function markRead(tenantId: string, id: string): void {
  notificationsRepo.update(tenantId, id, { read: true });
}

/** Mark every notification of a tenant as read. */
export function markAllRead(tenantId: string): void {
  notificationsRepo
    .list(tenantId)
    .filter((n) => !n.read)
    .forEach((n) => notificationsRepo.update(tenantId, n.id, { read: true }));
}

/** Human-readable relative time, e.g. "hace 5 min", "hace 2 h", "ayer". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}
