// Garage — create/edit agent dialog. All writes go through the agents helpers.
// The agent is a simulated AI inbox assistant: it answers by intent rules
// (trigger → response), smart intents (data access) and context docs.
// Everything is local & simulated.

import { useEffect, useRef, useState } from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
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
  DATA_ACCESS_LABELS,
  defaultDataAccess,
  defaultResponseHours,
  defaultTimezoneFor,
  newContextDocId,
  newReplyRule,
  TIMEZONES,
  updateAgent,
  WEEKDAY_LABELS,
} from "@/lib/agents";
import { tenantsRepo } from "@/lib/db";
import type {
  Agent,
  AgentContextDoc,
  AgentDataAccess,
  AgentReplyRule,
  AgentResponseHour,
} from "@/types";
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
  handoffMessage: string;
  replies: AgentReplyRule[];
  timezone: string;
  available247: boolean;
  responseHours: AgentResponseHour[];
  offHoursMessage: string;
  dataAccess: AgentDataAccess;
  contextDocs: AgentContextDoc[];
}

// Text docs (.txt/.md) keep their content; cap the stored text to protect the
// localStorage quota.
const MAX_DOC_TEXT = 8000;
const TEXT_EXTENSIONS = [".txt", ".md", ".markdown"];

function emptyForm(timezone: string): FormState {
  return {
    name: "",
    purpose: "",
    tone: "cercano",
    instructions: "",
    status: "active",
    handoffMessage:
      "Voy a pasar tu consulta a un compañero del taller, te responderá en breve.",
    replies: [newReplyRule()],
    timezone,
    available247: false,
    responseHours: defaultResponseHours(),
    offHoursMessage:
      "Ahora mismo estamos fuera de horario. Te responderemos en cuanto abramos. ¡Gracias!",
    dataAccess: defaultDataAccess(),
    contextDocs: [],
  };
}

export function AgentFormDialog({
  open,
  onOpenChange,
  tenantId,
  agent,
  onSaved,
}: AgentFormDialogProps) {
  const tenantTz = defaultTimezoneFor(tenantsRepo.getById(tenantId));
  const [form, setForm] = useState<FormState>(() => emptyForm(tenantTz));
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (agent) {
      setForm({
        name: agent.name,
        purpose: agent.purpose,
        tone: agent.tone,
        instructions: agent.instructions,
        status: agent.status,
        handoffMessage: agent.handoffMessage,
        replies: agent.replies.length ? agent.replies : [newReplyRule()],
        timezone: agent.timezone ?? tenantTz,
        available247: agent.available247 ?? false,
        responseHours:
          agent.responseHours && agent.responseHours.length === 7
            ? agent.responseHours
            : defaultResponseHours(),
        offHoursMessage: agent.offHoursMessage ?? "",
        dataAccess: agent.dataAccess ?? defaultDataAccess(),
        contextDocs: agent.contextDocs ?? [],
      });
    } else {
      setForm(emptyForm(tenantTz));
    }
    setError(null);
  }, [open, agent, tenantTz]);

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

  const setHour = (day: number, patch: Partial<AgentResponseHour>) =>
    setForm((f) => ({
      ...f,
      responseHours: f.responseHours.map((h) =>
        h.day === day ? { ...h, ...patch } : h,
      ),
    }));

  const toggleAccess = (key: keyof AgentDataAccess, v: boolean) =>
    setForm((f) => ({ ...f, dataAccess: { ...f.dataAccess, [key]: v } }));

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const additions: AgentContextDoc[] = [];
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      const isText = TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
      if (file.size > 1_000_000) {
        toast.error(`«${file.name}» es demasiado grande (máx. 1 MB).`);
        continue;
      }
      let text: string | undefined;
      if (isText) {
        const raw = await file.text();
        text = raw.slice(0, MAX_DOC_TEXT);
      }
      additions.push({
        id: newContextDocId(),
        name: file.name,
        type: file.type || (isText ? "text/plain" : "application/octet-stream"),
        text,
        createdAt: new Date().toISOString(),
      });
    }
    if (additions.length) {
      setForm((f) => ({ ...f, contextDocs: [...f.contextDocs, ...additions] }));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeDoc = (id: string) =>
    setForm((f) => ({
      ...f,
      contextDocs: f.contextDocs.filter((d) => d.id !== id),
    }));

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
      handoffMessage: form.handoffMessage.trim(),
      replies,
      timezone: form.timezone,
      available247: form.available247,
      responseHours: form.responseHours,
      offHoursMessage: form.offHoursMessage.trim(),
      dataAccess: form.dataAccess,
      contextDocs: form.contextDocs,
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
            Define cómo atiende la bandeja. Responde por reglas, intents
            inteligentes y documentos de contexto. Todo simulado.
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
              <Label>Zona horaria</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => set("timezone", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
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

          {/* Horario de respuestas */}
          <div className="space-y-3 rounded-md border border-border-subtle p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Disponible 24/7
                </p>
                <p className="text-xs text-muted-foreground">
                  El agente responde a cualquier hora.
                </p>
              </div>
              <Switch
                checked={form.available247}
                onCheckedChange={(v) => set("available247", v)}
              />
            </div>

            {!form.available247 && (
              <div className="space-y-2">
                <Label>Horario de respuestas</Label>
                <div className="space-y-1.5">
                  {form.responseHours.map((h) => (
                    <div key={h.day} className="flex items-center gap-2">
                      <Switch
                        checked={h.enabled}
                        onCheckedChange={(v) => setHour(h.day, { enabled: v })}
                        aria-label={WEEKDAY_LABELS[h.day]}
                      />
                      <span className="w-20 shrink-0 text-sm text-foreground">
                        {WEEKDAY_LABELS[h.day]}
                      </span>
                      <Input
                        type="time"
                        value={h.from}
                        disabled={!h.enabled}
                        onChange={(e) => setHour(h.day, { from: e.target.value })}
                        className="h-9"
                      />
                      <span className="text-xs text-muted-foreground">a</span>
                      <Input
                        type="time"
                        value={h.to}
                        disabled={!h.enabled}
                        onChange={(e) => setHour(h.day, { to: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="a-offhours">Mensaje fuera de horario</Label>
                  <Textarea
                    id="a-offhours"
                    value={form.offHoursMessage}
                    onChange={(e) => set("offHoursMessage", e.target.value)}
                    placeholder="Opcional. Si está vacío, fuera de horario pasa directamente a un humano."
                    className="min-h-[56px]"
                    maxLength={300}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Acceso a datos */}
          <div className="space-y-2 rounded-md border border-border-subtle p-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Acceso a datos
              </p>
              <p className="text-xs text-muted-foreground">
                A qué datos puede acceder el agente para responder.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {(Object.keys(DATA_ACCESS_LABELS) as Array<keyof AgentDataAccess>).map(
                (key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-foreground">
                      {DATA_ACCESS_LABELS[key]}
                    </span>
                    <Switch
                      checked={form.dataAccess[key]}
                      onCheckedChange={(v) => toggleAccess(key, v)}
                    />
                  </label>
                ),
              )}
            </div>
          </div>

          {/* Intents */}
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

          {/* Documentos de contexto */}
          <div className="space-y-2 rounded-md border border-border-subtle p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Documentos de contexto
                </p>
                <p className="text-xs text-muted-foreground">
                  .txt/.md se buscan por palabras clave. Otros tipos solo guardan
                  el nombre (en producción se procesan completos).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload strokeWidth={1.5} />
                Subir
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </div>
            {form.contextDocs.length > 0 && (
              <ul className="space-y-1.5">
                {form.contextDocs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded-md border border-border-subtle px-2.5 py-1.5"
                  >
                    <FileText
                      strokeWidth={1.5}
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {d.name}
                    </span>
                    {!d.text && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        solo nombre
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeDoc(d.id)}
                      aria-label="Eliminar documento"
                    >
                      <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
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
