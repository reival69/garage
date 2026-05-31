// Talleo — shared vehicle service-history list. Used by both the order view
// (/c/:code) and the permanent cartilla (/v/:code) so the expandable history,
// quote lines, DVI summary, warranty tags and printable invoices live in one
// place. Read-only; all data comes through the repos/helpers.

import { useState } from "react";
import {
  ChevronDown,
  Printer,
  ReceiptText,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/base/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InvoiceDocument,
  printInvoiceDocument,
} from "@/components/InvoiceDocument";
import { customersRepo } from "@/lib/db";
import { getInvoiceByWorkOrderId } from "@/lib/invoices";
import { inspectionSummary } from "@/lib/inspection";
import { warrantyLabel } from "@/lib/quotes";
import { formatCurrencyCents, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invoice, Tenant, Vehicle, WorkOrder } from "@/types";

export function VehicleHistory({
  orders,
  tenant,
  vehicle,
  emptyText = "Sin órdenes registradas para este vehículo.",
}: {
  orders: WorkOrder[];
  tenant: Tenant;
  vehicle?: Vehicle;
  emptyText?: string;
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {orders.map((o) => (
        <HistoryItem key={o.id} order={o} tenant={tenant} vehicle={vehicle} />
      ))}
    </ul>
  );
}

function HistoryItem({
  order,
  tenant,
  vehicle,
}: {
  order: WorkOrder;
  tenant: Tenant;
  vehicle?: Vehicle;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const invoice = getInvoiceByWorkOrderId(tenant.id, order.id);
  const dvi = order.inspection ? inspectionSummary(order.inspection.items) : null;

  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <ChevronDown
          strokeWidth={1.5}
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {order.problemDescription || "Visita al taller"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {invoice && (
            <span className="text-sm font-medium text-foreground">
              {formatCurrencyCents(invoice.total, tenant.currency)}
            </span>
          )}
          <StatusBadge status={order.status} />
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          {/* Quote lines + warranty tags */}
          {order.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin líneas de presupuesto registradas.
            </p>
          ) : (
            <div className="space-y-2">
              {order.items.map((it) => {
                const warranty = warrantyLabel(it);
                return (
                  <div key={it.id} className="text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-foreground">
                        {it.description}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {it.qty} ×{" "}
                          {formatCurrencyCents(it.unitPrice, tenant.currency)}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium text-foreground">
                        {formatCurrencyCents(
                          it.qty * it.unitPrice,
                          tenant.currency,
                        )}
                      </span>
                    </div>
                    {warranty && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-background-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <ShieldCheck strokeWidth={1.5} className="h-3 w-3" />
                        Garantía {warranty}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* DVI summary */}
          {dvi && dvi.total > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ScanLine strokeWidth={1.5} className="h-3.5 w-3.5" />
                Inspección
              </span>
              <SummaryDot color="var(--success)" label="OK" count={dvi.ok} />
              <SummaryDot
                color="var(--warning)"
                label="Atención"
                count={dvi.atencion}
              />
              <SummaryDot
                color="var(--destructive)"
                label="Crítico"
                count={dvi.critico}
              />
            </div>
          )}

          {invoice && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInvoiceOpen(true)}
            >
              <ReceiptText strokeWidth={1.5} />
              Ver / Imprimir factura
            </Button>
          )}
        </div>
      )}

      {invoice && (
        <HistoryInvoiceDialog
          open={invoiceOpen}
          onClose={() => setInvoiceOpen(false)}
          invoice={invoice}
          order={order}
          tenant={tenant}
          vehicle={vehicle}
        />
      )}
    </li>
  );
}

function SummaryDot({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {count} {label}
    </span>
  );
}

function HistoryInvoiceDialog({
  open,
  onClose,
  invoice,
  order,
  tenant,
  vehicle,
}: {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  order: WorkOrder;
  tenant: Tenant;
  vehicle?: Vehicle;
}) {
  const customer = customersRepo.getById(tenant.id, order.customerId);
  const location =
    tenant.locations.find((l) => l.id === order.locationId) ??
    tenant.locations[0];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Factura {invoice.number}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => printInvoiceDocument("invoice-history")}
            >
              <Printer strokeWidth={1.5} />
              Imprimir / PDF
            </Button>
          </DialogTitle>
        </DialogHeader>
        <InvoiceDocument
          invoice={invoice}
          tenant={tenant}
          customer={customer}
          vehicle={vehicle}
          location={location}
          printId="invoice-history"
        />
      </DialogContent>
    </Dialog>
  );
}
