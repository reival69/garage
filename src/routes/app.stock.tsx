// Garage — Stock / Inventario. Extends the parts catalog with inventory
// management: current units, minimum stock, warehouse location, a "Bajo stock"
// badge, search + low-stock filter, inline inventory editing and quick
// entrada/salida adjustments. Catalog CRUD (name/price/SKU) stays in /app/servicios.
// Everything is local & simulated.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  Boxes,
  Plus,
  Minus,
  Pencil,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { partsRepo } from "@/lib/db";
import { listStock, isLowStock, adjustStock } from "@/lib/stock";
import { formatCurrency } from "@/lib/format";
import { canEdit } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Part } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/stock")({
  component: StockPage,
});

function LowStockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-2 py-0.5 text-xs font-medium text-[var(--warning)]">
      <AlertTriangle strokeWidth={1.5} className="h-3 w-3" />
      Bajo stock
    </span>
  );
}

function StockPage() {
  const { tenant, user } = useAuth();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [adjusting, setAdjusting] = useState<Part | null>(null);

  if (!tenant || !user) return null;
  const editable = canEdit(user.role, "stock");
  const currency = tenant.currency;

  const parts = useMemo(() => listStock(tenant.id), [tenant.id, version]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (onlyLow && !isLowStock(p)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [parts, query, onlyLow]);

  const refresh = () => setVersion((v) => v + 1);

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Inventario de repuestos: existencias, mínimos y ubicación."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar repuesto, SKU o ubicación…"
            className="pl-9"
          />
        </div>
        <Button
          variant={onlyLow ? "default" : "outline"}
          onClick={() => setOnlyLow((v) => !v)}
        >
          <AlertTriangle strokeWidth={1.5} />
          Solo bajo stock
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={
            onlyLow
              ? "Sin repuestos bajo stock"
              : query
                ? "Sin resultados"
                : "Aún no hay repuestos"
          }
          description={
            onlyLow
              ? "Todo el inventario está por encima del mínimo."
              : query
                ? "Prueba con otro término de búsqueda."
                : "Crea repuestos desde el Catálogo para gestionarlos aquí."
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => {
              const low = isLowStock(p);
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{p.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{formatCurrency(p.price, currency)}</span>
                        {p.sku && (
                          <span className="font-mono text-xs">{p.sku}</span>
                        )}
                        {p.location && (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <MapPin strokeWidth={1.5} className="h-3 w-3" />
                            {p.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {low && <LowStockBadge />}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-foreground">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          low && "text-[var(--warning)]",
                        )}
                      >
                        {p.stockQty ?? 0}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        / mín. {p.minStock ?? 0}
                      </span>
                    </span>
                    {editable && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjusting(p)}
                        >
                          Ajustar
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditing(p)}
                          aria-label="Editar inventario"
                        >
                          <Pencil strokeWidth={1.5} className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background-subtle text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Repuesto</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Mínimo</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  {editable && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = isLowStock(p);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-background-subtle"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {low && <LowStockBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.location ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-semibold tabular-nums text-foreground",
                          low && "text-[var(--warning)]",
                        )}
                      >
                        {p.stockQty ?? 0}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {p.minStock ?? 0}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatCurrency(p.price, currency)}
                      </td>
                      {editable && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAdjusting(p)}
                            >
                              Ajustar
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditing(p)}
                              aria-label="Editar inventario"
                            >
                              <Pencil strokeWidth={1.5} className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <InventoryDialog
        key={`edit-${editing?.id ?? "none"}`}
        part={editing}
        tenantId={tenant.id}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />

      <AdjustDialog
        key={`adj-${adjusting?.id ?? "none"}`}
        part={adjusting}
        tenantId={tenant.id}
        currency={currency}
        onOpenChange={(o) => !o && setAdjusting(null)}
        onSaved={() => {
          setAdjusting(null);
          refresh();
        }}
      />
    </div>
  );
}

// ── Editar inventario ─────────────────────────────────────────────────────

function InventoryDialog({
  part,
  tenantId,
  onOpenChange,
  onSaved,
}: {
  part: Part | null;
  tenantId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [stockQty, setStockQty] = useState(String(part?.stockQty ?? 0));
  const [minStock, setMinStock] = useState(String(part?.minStock ?? 0));
  const [location, setLocation] = useState(part?.location ?? "");

  if (!part) return null;

  const submit = () => {
    const qty = Math.max(0, Math.round(Number(stockQty) || 0));
    const min = Math.max(0, Math.round(Number(minStock) || 0));
    const patch: Partial<Part> = {
      stockQty: qty,
      minStock: min,
      location: location.trim() || undefined,
    };
    // Re-arm the low-stock alert if it's now above the minimum.
    if (part.lowStockNotified && qty > min) patch.lowStockNotified = false;
    partsRepo.update(tenantId, part.id, patch);
    toast.success("Inventario actualizado");
    onSaved();
  };

  return (
    <Dialog open={!!part} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar inventario</DialogTitle>
          <DialogDescription>{part.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-qty">Stock actual</Label>
              <Input
                id="s-qty"
                type="number"
                min={0}
                step="1"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-min">Stock mínimo</Label>
              <Input
                id="s-min"
                type="number"
                min={0}
                step="1"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-loc">Ubicación</Label>
            <Input
              id="s-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Estante A-3"
              maxLength={60}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Ajuste rápido (entrada / salida) ───────────────────────────────────────

function AdjustDialog({
  part,
  tenantId,
  currency,
  onOpenChange,
  onSaved,
}: {
  part: Part | null;
  tenantId: string;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("1");

  if (!part) return null;

  const qty = Math.max(1, Math.round(Number(amount) || 0));

  const apply = (sign: 1 | -1) => {
    adjustStock(tenantId, part.id, sign * qty);
    toast.success(sign > 0 ? "Entrada registrada" : "Salida registrada");
    onSaved();
  };

  return (
    <Dialog open={!!part} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            {part.name} · {formatCurrency(part.price, currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background-subtle px-3 py-2 text-sm">
            <span className="text-muted-foreground">Stock actual</span>
            <span className="font-semibold tabular-nums text-foreground">
              {part.stockQty ?? 0}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-qty">Cantidad</Label>
            <Input
              id="a-qty"
              type="number"
              min={1}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="outline" onClick={() => apply(-1)}>
            <Minus strokeWidth={1.5} />
            Salida
          </Button>
          <Button onClick={() => apply(1)}>
            <Plus strokeWidth={1.5} />
            Entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
