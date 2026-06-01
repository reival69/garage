// Talleo — Mensajes. A WhatsApp-style inbox where each conversation is the
// message thread of a work order (OrderMessage, bidirectional shop↔customer).
// Desktop: two columns (conversation list + thread). Mobile: list, then the
// thread full-screen with a back button. Monochrome aesthetic — shop bubbles
// use the accent, customer bubbles a neutral grey (no WhatsApp green).
// Everything is local & simulated.

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  MessageSquare,
  Send,
  ArrowLeft,
  Car,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listConversations,
  markConversationRead,
  type Conversation,
} from "@/lib/inbox";
import { addShopMessage, STATUS_LABELS } from "@/lib/orders";
import { formatTime, isToday } from "@/lib/format";
import { relativeTime } from "@/lib/notifications";

import { canEdit } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/mensajes")({
  component: MessagesPage,
});

function previewTime(iso: string): string {
  return isToday(iso) ? formatTime(iso) : relativeTime(iso);
}

function MessagesPage() {
  const { tenant, user } = useAuth();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const tenantId = tenant?.id;
  const writable = user ? canEdit(user.role, "mensajes") : false;

  const conversations = useMemo(
    () => (tenantId ? listConversations(tenantId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId, version],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = c.customer?.name.toLowerCase() ?? "";
      const plate = c.vehicle?.plate.toLowerCase() ?? "";
      return name.includes(q) || plate.includes(q);
    });
  }, [conversations, query]);

  const active = useMemo(
    () => conversations.find((c) => c.order.id === activeId) ?? null,
    [conversations, activeId],
  );

  // When opening a conversation, mark the customer messages as read.
  const openConversation = (orderId: string) => {
    if (!tenantId) return;
    markConversationRead(tenantId, orderId);
    setActiveId(orderId);
    setVersion((v) => v + 1);
  };

  const refresh = () => setVersion((v) => v + 1);

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader
        title="Mensajes"
        description="Conversaciones con tus clientes, una por orden."
      />

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Sin conversaciones"
          description="Cuando haya mensajes en una orden, aparecerán aquí."
        />
      ) : (
        <div className="grid h-[calc(100vh-13rem)] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[20rem_1fr]">
          {/* Conversation list */}
          <div
            className={cn(
              "flex min-h-0 flex-col border-border md:border-r",
              active ? "hidden md:flex" : "flex",
            )}
          >
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search
                  strokeWidth={1.5}
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar cliente o matrícula…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Sin resultados.
                </p>
              ) : (
                filtered.map((c) => (
                  <ConversationRow
                    key={c.order.id}
                    conversation={c}
                    active={c.order.id === activeId}
                    onClick={() => openConversation(c.order.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Thread */}
          <div
            className={cn(
              "min-h-0 flex-col",
              active ? "flex" : "hidden md:flex",
            )}
          >
            {active ? (
              <Thread
                key={active.order.id}
                conversation={active}
                tenantId={tenantId}
                writable={writable}
                onBack={() => setActiveId(null)}
                onSent={refresh}
              />
            ) : (
              <div className="hidden flex-1 items-center justify-center md:flex">
                <div className="text-center">
                  <MessageSquare
                    strokeWidth={1.5}
                    className="mx-auto mb-2 h-7 w-7 text-muted-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    Elige una conversación para ver el chat.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  conversation: c,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-background-subtle",
        active && "bg-background-subtle",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              c.unread > 0 ? "font-semibold text-foreground" : "text-foreground",
            )}
          >
            {c.customer?.name ?? "Cliente"}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {previewTime(c.lastActivity)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Car strokeWidth={1.5} className="h-3 w-3" />
          {c.vehicle?.plate ?? "—"}
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span
            className={cn(
              "line-clamp-1 text-xs",
              c.unread > 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {c.lastMessage.from === "shop" && "Tú: "}
            {c.lastMessage.text}
          </span>
          {c.unread > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground">
              {c.unread > 9 ? "9+" : c.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function Thread({
  conversation: c,
  tenantId,
  writable,
  onBack,
  onSent,
}: {
  conversation: Conversation;
  tenantId: string;
  writable: boolean;
  onBack: () => void;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const order = c.order;
  const messages = useMemo(
    () =>
      [...order.messages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [order.messages],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    addShopMessage(tenantId, order, t);
    setText("");
    onSent();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 md:hidden"
          onClick={onBack}
          aria-label="Atrás"
        >
          <ArrowLeft strokeWidth={1.5} className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {c.customer?.name ?? "Cliente"}
          </p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span>
              {c.vehicle
                ? `${c.vehicle.make} ${c.vehicle.model} · ${c.vehicle.plate}`
                : "—"}
            </span>
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium">
              {STATUS_LABELS[order.status]}
            </span>
          </p>
        </div>
        <Link
          to="/app/ordenes/$id"
          params={{ id: order.id }}
          className="flex h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background-muted hover:text-foreground"
        >
          Ver orden
          <ExternalLink strokeWidth={1.5} className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-background-subtle px-4 py-4"
      >
        {messages.map((m) => {
          const fromShop = m.from === "shop";
          return (
            <div
              key={m.id}
              className={cn("flex", fromShop ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                  fromShop
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-secondary text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p
                  className={cn(
                    "mt-1 text-right text-[10px]",
                    fromShop
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      {writable ? (
        <div className="flex items-end gap-2 border-t border-border p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Escribe un mensaje al cliente…"
            className="min-h-[40px] resize-none"
            maxLength={500}
          />
          <Button
            size="icon"
            onClick={send}
            disabled={!text.trim()}
            className="shrink-0"
            aria-label="Enviar"
          >
            <Send strokeWidth={1.5} />
          </Button>
        </div>
      ) : (
        <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          No tienes permiso para responder mensajes.
        </p>
      )}
    </div>
  );
}
