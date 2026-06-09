// Talleo — create/edit agent dialog. All writes go through the agents helpers.
// The agent is a simulated AI inbox assistant: it answers by intent rules
// (trigger → response). Everything is local & simulated.

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGENT_TONES,
  createAgent,
  newReplyRule,
  updateAgent,
} from "@/lib/agents";
import type { Agent, AgentReplyRule } from "@/types";
import { toast } from "sonner";

interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  agent?: Agent | null;
  onSaved?: (agent: Agent) => void;
}

interface FormState {
  name: string;
  purpose: string;
  tone: string;
  instructions: string;
  status: Agent["status"];
  schedule: Agent["schedule"];
  handoffMessage: string;
  replies: AgentReplyRule[];
}

function emptyForm(): FormState {
  return {
    name: "",
    purpose: "",
    tone: "cercano",
    instructions: "",
    status: "active",
    schedule: "always",
    handoffMessage:
      "Voy a pasar tu consulta a un compañero del taller, te responderá en breve.",
    replies: [newReplyRule()],
  };
}

export function AgentFormDialog({
  open,
  onOpenChange,
  tenantId,
  agent,
  onSaved,
}: AgentFormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (agent) {
      setForm({
        name: agent.name,
        purpose: agent.purpose,
        tone: agent.tone,
        instructions: agent.instructions,
        status: agent.status,
        schedule: agent.schedule,
        handoffMessage: agent.handoffMessage,
        replies: agent.replies.length ? agent.replies : [newReplyRule()],
      });
    } else {
      setForm(emptyForm());
    }
    setError(null);
  }, [open, agent]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setRule = (id: string, patch: Partial<AgentReplyRule>) =>
    setForm((f) => ({
      ...f,
      replies: f.replies.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  const addRule = () =>
    setForm((f) => ({ ...f, replies: [...f.replies, newReplyRule()] }));

  const removeRule = (id: string) =>
    setForm((f) => ({ ...f, replies: f.replies.filter((r) => r.id !== id) }));

  const submit = () => {
    if (!form.name.trim()) {
      setError("El nombre del agente es obligatorio.");
      return;
    }
    const replies = form.replies
      .map((r) => ({
        ...r,
        trigger: r.trigger.trim(),
        response: r.response.trim(),
      }))
      .filter((r) => r.trigger && r.response);

    const payload = {
      name: form.name.trim(),
      purpose: form.purpose.trim(),
      tone: form.tone,
      instructions: form.instructions.trim(),
      status: form.status,
      schedule: form.schedule,
      handoffMessage: form.handoffMessage.trim(),
      replies,
    };

    let saved: Agent | undefined;
    if (agent) {
      saved = updateAgent(tenantId, agent.id, payload);
      toast.success("Agente actualizado");
    } else {
      saved = createAgent(tenantId, payload);
      toast.success("Agente creado");
    }
    if (saved) onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{agent ? "Editar agente" : "Nuevo agente"}</DialogTitle>
          <DialogDescription>
            Define cómo atiende la bandeja. Responde por reglas (disparador →
            respuesta). Todo simulado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="a-name">Nombre *</Label>
            <Input
              id="a-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Recepción IA"
              maxLength={60}
            />
            {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-purpose">Propósito / rol</Label>
            <Input
              id="a-purpose"
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              placeholder="Atender el primer contacto de clientes"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tono</Label>
              <Select value={form.tone} onValueChange={(v) => set("tone", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Horario</Label>
              <Select
                value={form.schedule}
                onValueChange={(v) =>
                  set("schedule", v as Agent["schedule"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Siempre</SelectItem>
                  <SelectItem value="after_hours">
                    Solo fuera de horario
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-instructions">Instrucciones</Label>
            <Textarea
              id="a-instructions"
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="En producción, este texto guiaría el comportamiento del agente con IA."
              className="min-h-[72px]"
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Intents (disparador → respuesta)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRule}>
                <Plus strokeWidth={1.5} />
                Añadir
              </Button>
            </div>
            <div className="space-y-3">
              {form.replies.map((r) => (
                <div
                  key={r.id}
                  className="space-y-2 rounded-md border border-border-subtle p-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={r.trigger}
                      onChange={(e) => setRule(r.id, { trigger: e.target.value })}
                      placeholder="Disparador: horario, abren, abierto"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeRule(r.id)}
                      aria-label="Eliminar intent"
                    >
                      <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={r.response}
                    onChange={(e) => setRule(r.id, { response: e.target.value })}
                    placeholder="Respuesta del agente…"
                    className="min-h-[56px]"
                    maxLength={400}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Separa varias palabras clave con comas. El agente responde con el
              primer intent que aparezca en el mensaje del cliente.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-handoff">Mensaje de handoff</Label>
            <Textarea
              id="a-handoff"
              value={form.handoffMessage}
              onChange={(e) => set("handoffMessage", e.target.value)}
              placeholder="Mensaje cuando ningún intent coincide y pasa a un humano."
              className="min-h-[56px]"
              maxLength={300}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Activo</p>
              <p className="text-xs text-muted-foreground">
                Un agente pausado no responde la bandeja.
              </p>
            </div>
            <Switch
              checked={form.status === "active"}
              onCheckedChange={(v) => set("status", v ? "active" : "paused")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{agent ? "Guardar" : "Crear agente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
