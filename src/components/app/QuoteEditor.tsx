// Talleo — editor de presupuestos dentro de la ficha de orden. Permite añadir
// líneas desde el catálogo (servicios/repuestos) o personalizadas, editarlas,
// eliminarlas, ver totales en vivo con el IVA del taller y enviar el
// presupuesto al cliente (simulado). Todo pasa por src/lib/quotes.ts.

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Send } from "lucide-react";
import { DataCard } from "@/components/base/DataCard";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { partsRepo, servicesRepo } from "@/lib/db";
import {
  addQuoteItem,
  lineAmount,
  quoteSummary,
  removeQuoteItem,
  updateQuoteItem,
  sendQuote,
  warrantyLabel,
  type QuoteItemInput,
} from "@/lib/quotes";
import { quoteTotals } from "@/lib/orders";
import { formatCurrencyCents } from "@/lib/format";
import type { QuoteItem, Tenant, WorkOrder } from "@/types";
import { toast } from "sonner";

const TYPE_LABEL: Record<QuoteItem["type"], string> = {
  labor: "Mano de obra",
  part: "Repuesto",
};

export function QuoteEditor({
  order,
  tenant,
  onSaved,
}: {
  order: WorkOrder;
  tenant: Tenant;
  onSaved: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteItem | null>(null);

  const totals = quoteTotals(order.items, tenant.taxRate);
  const summary = quoteSummary(order.items);
  const taxPct = Math.round(tenant.taxRate * 100);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (item: QuoteItem) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleRemove = (item: QuoteItem) => {
    removeQuoteItem(tenant.id, order, item.id);
    toast.success("Línea eliminada");
    onSaved();
  };

  const handleSubmit = (input: QuoteItemInput) => {
    if (editing) {
      updateQuoteItem(tenant.id, order, editing.id, input);
      toast.success("Línea actualizada");
    } else {
      addQuoteItem(tenant.id, order, input);
      toast.success("Línea añadida");
    }
    setDialogOpen(false);
    onSaved();
  };

  const handleSend = () => {
    if (order.items.length === 0) {
      toast.error("Añade al menos una línea antes de enviar.");
      return;
    }
    sendQuote(tenant, order);
    toast.success("Presupuesto enviado al cliente");
    onSaved();
  };

  return (
    <DataCard
      title="Presupuesto"
      actions={
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus strokeWidth={1.5} />
          Añadir línea
        </Button>
      }
    >
      {order.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay líneas de presupuesto. Añade mano de obra o repuestos.
        </p>
      ) : (
        <div className="space-y-2">
          {order.items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-background-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {TYPE_LABEL[it.type]}
                  </span>
                  <StatusBadge status={it.approval} />
                </div>
                <p className="mt-1 truncate text-sm text-foreground">
                  {it.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {it.qty} × {formatCurrencyCents(it.unitPrice, tenant.currency)}
                </p>
                {warrantyLabel(it) && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-background-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <ShieldCheck strokeWidth={1.5} className="h-3 w-3" />
                    Garantía: {warrantyLabel(it)}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrencyCents(lineAmount(it), tenant.currency)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEdit(it)}
                    aria-label="Editar línea"
                  >
                    <Pencil strokeWidth={1.5} className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-[var(--destructive)]"
                    onClick={() => handleRemove(it)}
                    aria-label="Eliminar línea"
                  >
                    <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      {order.items.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          <Row
            label="Subtotal"
            value={formatCurrencyCents(totals.subtotal, tenant.currency)}
          />
          <Row
            label={`IVA (${taxPct}%)`}
            value={formatCurrencyCents(totals.tax, tenant.currency)}
          />
          <div className="flex items-center justify-between pt-1 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCurrencyCents(totals.total, tenant.currency)}</span>
          </div>
        </div>
      )}

      {/* Approval summary + send */}
      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {summary.total} {summary.total === 1 ? "línea" : "líneas"} ·{" "}
          <span className="text-[var(--warning)]">{summary.pending} pend.</span>{" "}
          ·{" "}
          <span className="text-[var(--success)]">
            {summary.approved} aprob.
          </span>{" "}
          ·{" "}
          <span className="text-[var(--destructive)]">
            {summary.rejected} rech.
          </span>
        </p>
        <Button size="sm" onClick={handleSend} disabled={order.items.length === 0}>
          <Send strokeWidth={1.5} />
          {order.status === "presupuesto_enviado"
            ? "Reenviar presupuesto"
            : "Enviar presupuesto"}
        </Button>
      </div>

      <QuoteItemDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={tenant}
        item={editing}
        onSubmit={handleSubmit}
      />
    </DataCard>
  );
}

const CUSTOM = "__custom__";

function QuoteItemDialog({
  open,
  onOpenChange,
  tenant,
  item,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenant: Tenant;
  item: QuoteItem | null;
  onSubmit: (input: QuoteItemInput) => void;
}) {
  const services = useMemo(() => servicesRepo.list(tenant.id), [tenant.id]);
  const parts = useMemo(() => partsRepo.list(tenant.id), [tenant.id]);

  const [type, setType] = useState<QuoteItem["type"]>(item?.type ?? "labor");
  const [catalogId, setCatalogId] = useState<string>(CUSTOM);
  const [description, setDescription] = useState(item?.description ?? "");
  const [qty, setQty] = useState(String(item?.qty ?? 1));
  const [unitPrice, setUnitPrice] = useState(String(item?.unitPrice ?? 0));

  const onTypeChange = (v: QuoteItem["type"]) => {
    setType(v);
    setCatalogId(CUSTOM);
  };

  const onCatalogChange = (v: string) => {
    setCatalogId(v);
    if (v === CUSTOM) return;
    if (type === "labor") {
      const s = services.find((x) => x.id === v);
      if (s) {
        setDescription(s.name);
        setUnitPrice(String(s.basePrice));
      }
    } else {
      const p = parts.find((x) => x.id === v);
      if (p) {
        setDescription(p.name);
        setUnitPrice(String(p.price));
      }
    }
  };

  const qtyNum = Number(qty) || 0;
  const priceNum = Number(unitPrice) || 0;
  const amount = qtyNum * priceNum;
  const valid = description.trim().length > 0 && qtyNum > 0 && priceNum >= 0;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      type,
      description: description.trim(),
      qty: qtyNum,
      unitPrice: priceNum,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Editar línea" : "Añadir línea"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => onTypeChange(v as QuoteItem["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="labor">Mano de obra</SelectItem>
                <SelectItem value="part">Repuesto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{type === "labor" ? "Servicio" : "Repuesto"}</Label>
            <Select value={catalogId} onValueChange={onCatalogChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CUSTOM}>Personalizado</SelectItem>
                {type === "labor"
                  ? services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {formatCurrencyCents(s.basePrice, tenant.currency)}
                      </SelectItem>
                    ))
                  : parts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {formatCurrencyCents(p.price, tenant.currency)}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setCatalogId(CUSTOM);
              }}
              placeholder="Descripción de la línea"
              maxLength={160}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Precio unitario</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background-subtle px-3 py-2 text-sm">
            <span className="text-muted-foreground">Importe</span>
            <span className="font-medium text-foreground">
              {formatCurrencyCents(amount, tenant.currency)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {item ? "Guardar" : "Añadir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
