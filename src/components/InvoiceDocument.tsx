// Talleo — Shared printable invoice document. Renders the fiscal sheet (tenant
// fiscal data, customer, vehicle, lines, subtotal, IVA, total and payment
// status) plus the scoped print CSS. Reused by the shop's /app/facturacion/:id
// route and by the customer view /c/:code so the customer can also print / save
// a PDF. All read-only & local — no persistence happens here.

import type { Customer, Invoice, Location, Tenant, Vehicle } from "@/types";
import { StatusBadge } from "@/components/base/StatusBadge";
import { INVOICE_STATUS_LABELS } from "@/lib/invoices";
import { warrantyLabel } from "@/lib/quotes";
import { formatCurrencyCents, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface InvoiceDocumentProps {
  invoice: Invoice;
  tenant: Tenant;
  customer?: Customer;
  vehicle?: Vehicle;
  location?: Location;
  /** Unique id used to isolate this sheet when printing. */
  printId?: string;
  className?: string;
}

/**
 * Trigger the browser print dialog isolating a single invoice sheet.
 * Adds a body class scoped to the sheet's id so only that element prints,
 * even when several InvoiceDocuments are mounted at once (e.g. the inline
 * order invoice plus one opened in a dialog).
 */
export function printInvoiceDocument(printId = "invoice-print") {
  const cls = `print-${printId}`;
  const cleanup = () => {
    document.body.classList.remove(cls);
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  document.body.classList.add(cls);
  window.print();
  // Safety net for browsers that don't fire afterprint reliably.
  window.setTimeout(cleanup, 1500);
}

export function InvoiceDocument({
  invoice,
  tenant,
  customer,
  vehicle,
  location,
  printId = "invoice-print",
  className,
}: InvoiceDocumentProps) {
  const loc = location ?? tenant.locations[0];

  return (
    <>
      {/* Print CSS: hide everything except this sheet, scoped by body class. */}
      <style>{`
        @media print {
          body.print-${printId} * { visibility: hidden !important; }
          body.print-${printId} #${printId},
          body.print-${printId} #${printId} * { visibility: visible !important; }
          body.print-${printId} #${printId} {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0; border: none;
          }
        }
      `}</style>

      <div
        id={printId}
        className={cn(
          "rounded-xl border border-border bg-card p-6 sm:p-10",
          className,
        )}
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
            {loc?.address && (
              <p className="mt-1 text-sm text-muted-foreground">{loc.address}</p>
            )}
            {(tenant.phone || loc?.phone) && (
              <p className="text-sm text-muted-foreground">
                {tenant.phone || loc?.phone}
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
                    {formatCurrencyCents(it.qty * it.unitPrice, tenant.currency)}
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
    </>
  );
}
