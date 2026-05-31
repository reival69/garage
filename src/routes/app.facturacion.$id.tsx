// Talleo — Ficha de factura. Reutiliza el componente compartido InvoiceDocument
// para el cuerpo imprimible (datos fiscales/cliente/vehículo/líneas/totales) y
// añade el control de estado de cobro. Botón «Imprimir / Guardar PDF» aísla la
// hoja con printInvoiceDocument. Todo local y simulado.

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { EmptyState } from "@/components/base/EmptyState";
import {
  InvoiceDocument,
  printInvoiceDocument,
} from "@/components/InvoiceDocument";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  customersRepo,
  invoicesRepo,
  vehiclesRepo,
  workOrdersRepo,
} from "@/lib/db";
import { setInvoiceStatus } from "@/lib/invoices";
import type { Invoice } from "@/types";

export const Route = createFileRoute("/app/facturacion/$id")({
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { ready, tenant } = useAuth();
  const [version, setVersion] = useState(0);

  const invoice = useMemo(() => {
    if (!ready || !tenant) return null;
    return invoicesRepo.getById(tenant.id, id) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, id, version]);

  if (!tenant) return null;
  if (!invoice) {
    return (
      <div>
        <BackLink />
        <EmptyState
          title="Factura no encontrada"
          description="Es posible que se haya eliminado."
        />
      </div>
    );
  }

  const order = workOrdersRepo.getById(tenant.id, invoice.workOrderId);
  const customer = order
    ? customersRepo.getById(tenant.id, order.customerId)
    : undefined;
  const vehicle = order
    ? vehiclesRepo.getById(tenant.id, order.vehicleId)
    : undefined;
  const location =
    tenant.locations.find((l) => l.id === order?.locationId) ??
    tenant.locations[0];

  const changeStatus = (status: Invoice["status"]) => {
    setInvoiceStatus(tenant.id, invoice.id, status);
    setVersion((v) => v + 1);
  };

  return (
    <div>
      {/* Print CSS: hide everything except the invoice sheet. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print, #invoice-print * { visibility: visible !important; }
          #invoice-print {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0; border: none;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <BackLink />
        <div className="flex items-center gap-2">
          <Select value={invoice.status} onValueChange={changeStatus}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="partial">Parcial</SelectItem>
              <SelectItem value="paid">Pagada</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()}>
            <Printer strokeWidth={1.5} />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Invoice sheet */}
      <div
        id="invoice-print"
        className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 sm:p-10"
      >
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {tenant.logoUrl && (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="mb-3 h-9 w-auto max-w-[160px] object-contain"
              />
            )}
            <h1 className="text-xl font-semibold text-foreground">
              {tenant.legalName?.trim() || tenant.name}
            </h1>
            {tenant.taxId && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {tenant.taxId}
              </p>
            )}
            {location?.address && (
              <p className="mt-1 text-sm text-muted-foreground">
                {location.address}
              </p>
            )}
            {(tenant.phone || location?.phone) && (
              <p className="text-sm text-muted-foreground">
                {tenant.phone || location?.phone}
              </p>
            )}
            {tenant.email && (
              <p className="text-sm text-muted-foreground">{tenant.email}</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="font-mono text-lg font-semibold text-foreground">
              {invoice.number}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(invoice.createdAt)}
            </p>
            <div className="mt-2">
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </div>

        {/* Customer & vehicle */}
        <div className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cliente
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {customer?.name ?? "—"}
            </p>
            {customer?.phone && (
              <p className="text-sm text-muted-foreground">{customer.phone}</p>
            )}
            {customer?.email && (
              <p className="text-sm text-muted-foreground">{customer.email}</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vehículo
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {vehicle ? `${vehicle.make} ${vehicle.model}` : "—"}
            </p>
            {vehicle && (
              <p className="font-mono text-sm text-muted-foreground">
                {vehicle.plate}
              </p>
            )}
          </div>
        </div>

        {/* Lines */}
        <div className="py-6">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Descripción</th>
                <th className="pb-2 text-center font-medium">Cant.</th>
                <th className="pb-2 text-right font-medium">Precio</th>
                <th className="pb-2 text-right font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => (
                <tr key={it.id} className="border-b border-border-subtle">
                  <td className="py-2.5 text-foreground">
                    {it.description}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {it.type === "labor" ? "Mano de obra" : "Pieza"}
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-muted-foreground">
                    {it.qty}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {formatCurrencyCents(it.unitPrice, tenant.currency)}
                  </td>
                  <td className="py-2.5 text-right text-foreground">
                    {formatCurrencyCents(
                      it.qty * it.unitPrice,
                      tenant.currency,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">
                {formatCurrencyCents(invoice.subtotal, tenant.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                IVA ({Math.round(tenant.taxRate * 100)}%)
              </span>
              <span className="text-foreground">
                {formatCurrencyCents(invoice.tax, tenant.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">
                {formatCurrencyCents(invoice.total, tenant.currency)}
              </span>
            </div>
            <p className="pt-1 text-right text-xs text-muted-foreground">
              Estado de cobro: {INVOICE_STATUS_LABELS[invoice.status]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/app/facturacion"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft strokeWidth={1.5} className="h-4 w-4" />
      Facturación
    </Link>
  );
}
