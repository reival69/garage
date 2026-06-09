// Talleo — Agentes. Manage simulated AI assistants that attend the message
// inbox. List agents with status + simulated stats (derived from sentByAgent
// messages), create/edit them, test them in a sandbox, and a placeholder card
// for the (simulated) Meta WhatsApp connection. Everything is local & simulated.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Send,
  MessageSquare,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AgentFormDialog } from "@/components/app/AgentFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  agentReply,
  agentStats,
  isAgentWithinHours,
  listAgents,
  removeAgent,
  TONE_LABELS,
  toggleAgentStatus,
} from "@/lib/agents";
import { canEdit } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/agentes")({
  component: AgentsPage,
});

function AgentsPage() {
  const { tenant, user } = useAuth();
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [toDelete, setToDelete] = useState<Agent | null>(null);

  const tenantId = tenant?.id;
  const editable = user ? canEdit(user.role, "agentes") : false;

  const agents = useMemo(
    () => (tenantId ? listAgents(tenantId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId, version],
  );
  const stats = useMemo(
    () => (tenantId ? agentStats(tenantId) : { conversations: 0, messages: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId, version],
  );

  if (!tenantId) return null;

  const refresh = () => setVersion((v) => v + 1);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (a: Agent) => {
    setEditing(a);
    setDialogOpen(true);
  };
  const toggle = (a: Agent) => {
    toggleAgentStatus(tenantId, a.id);
    refresh();
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    removeAgent(tenantId, toDelete.id);
    toast.success("Agente eliminado");
    setToDelete(null);
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Agentes"
        description="Asistentes que atienden tu bandeja de mensajes automáticamente."
        actions={
          editable ? (
            <Button onClick={openNew}>
              <Plus strokeWidth={1.5} />
              Nuevo agente
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessagesSquare strokeWidth={1.5} className="h-4 w-4" />
            <span className="text-xs">Conversaciones gestionadas</span>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {stats.conversations}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Send strokeWidth={1.5} className="h-4 w-4" />
            <span className="text-xs">Mensajes enviados</span>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {stats.messages}
          </p>
        </div>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Aún no hay agentes"
          description="Crea un agente para que atienda la bandeja con respuestas automáticas."
          action={
            editable ? (
              <Button onClick={openNew}>
                <Plus strokeWidth={1.5} />
                Nuevo agente
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {agents.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                    <Bot strokeWidth={1.5} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        {a.name}
                      </p>
                      <StatusPill status={a.status} />
                    </div>
                    {a.purpose && (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {a.purpose}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Tag>Tono: {TONE_LABELS[a.tone] ?? a.tone}</Tag>
                      <Tag>
                        {a.available247
                          ? "24/7"
                          : isAgentWithinHours(a)
                            ? "En horario"
                            : "Fuera de horario"}
                      </Tag>
                      {a.timezone && <Tag>{a.timezone}</Tag>}
                      <Tag>
                        {a.replies.length} intent
                        {a.replies.length === 1 ? "" : "s"}
                      </Tag>
                    </div>
                  </div>
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggle(a)}
                      aria-label={a.status === "active" ? "Pausar" : "Activar"}
                      title={a.status === "active" ? "Pausar" : "Activar"}
                    >
                      {a.status === "active" ? (
                        <Pause strokeWidth={1.5} className="h-4 w-4" />
                      ) : (
                        <Play strokeWidth={1.5} className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(a)}
                      aria-label="Editar"
                    >
                      <Pencil strokeWidth={1.5} className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setToDelete(a)}
                      aria-label="Eliminar"
                    >
                      <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sandbox */}
      {agents.length > 0 && <Sandbox agents={agents} tenantId={tenantId} />}

      {/* Meta WhatsApp connection (simulated placeholder) */}
      <MetaConnectionCard />

      <AgentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenantId}
        agent={editing}
        onSaved={refresh}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar agente</AlertDialogTitle>
            <AlertDialogDescription>
              {`¿Seguro que quieres eliminar «${toDelete?.name}»? Las conversaciones que gestionaba pasarán a atenderse manualmente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusPill({ status }: { status: Agent["status"] }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        active
          ? "bg-primary/10 text-primary"
          : "bg-background-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-primary" : "bg-muted-foreground",
        )}
      />
      {active ? "Activo" : "Pausado"}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border-subtle px-2 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

// ── Sandbox ─────────────────────────────────────────────────────────────────

interface SandboxMessage {
  id: number;
  from: "customer" | "agent";
  text: string;
}

function Sandbox({ agents, tenantId }: { agents: Agent[]; tenantId: string }) {
  const [agentId, setAgentId] = useState(agents[0].id);
  const [text, setText] = useState("");
  const [log, setLog] = useState<SandboxMessage[]>([]);
  const seq = useMemo(() => ({ n: 0 }), []);

  const agent = agents.find((a) => a.id === agentId) ?? agents[0];

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const result = agentReply(agent, t, { tenantId });
    setLog((prev) => [
      ...prev,
      { id: ++seq.n, from: "customer", text: t },
      { id: ++seq.n, from: "agent", text: result.text || "(sin respuesta)" },
    ]);
    setText("");
  };

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles strokeWidth={1.5} className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-medium text-foreground">Probar agente</h2>
        </div>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Escribe como si fueras un cliente y comprueba cómo responde el agente.
        Es un sandbox local, no toca la bandeja real.
      </p>

      <div className="mb-3 max-h-64 min-h-24 space-y-2 overflow-y-auto rounded-lg bg-background-subtle p-3">
        {log.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aún no hay mensajes. Prueba a escribir «¿A qué hora abrís?».
          </p>
        ) : (
          log.map((m) => {
            const fromAgent = m.from === "agent";
            return (
              <div
                key={m.id}
                className={cn("flex", fromAgent ? "justify-start" : "justify-end")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    fromAgent
                      ? "rounded-bl-sm bg-secondary text-foreground"
                      : "rounded-br-sm bg-primary text-primary-foreground",
                  )}
                >
                  {fromAgent && (
                    <span className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      <Bot strokeWidth={1.5} className="h-3 w-3" />
                      {agent.name}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Escribe como cliente…"
        />
        <Button onClick={send} disabled={!text.trim()} size="icon" aria-label="Enviar">
          <Send strokeWidth={1.5} />
        </Button>
      </div>
    </section>
  );
}

// ── Meta WhatsApp connection (simulated) ─────────────────────────────────────

function MetaConnectionCard() {
  return (
    <section className="mt-6 rounded-xl border border-dashed border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
            <MessageSquare strokeWidth={1.5} className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-foreground">
                Conexión con Meta WhatsApp
              </h2>
              <span className="rounded-md border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Simulado
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Estado:{" "}
              <span className="font-medium text-foreground">No conectado</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              En esta demo la integración con WhatsApp es un placeholder visual,
              sin conexión real.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => toast.info("Disponible en producción")}
        >
          Conectar con Meta
        </Button>
      </div>
    </section>
  );
}
