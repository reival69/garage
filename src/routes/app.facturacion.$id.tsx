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
          <Button onClick={() => printInvoiceDocument("invoice-print")}>
            <Printer strokeWidth={1.5} />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      <InvoiceDocument
        invoice={invoice}
        tenant={tenant}
        customer={customer}
        vehicle={vehicle}
        location={location}
        printId="invoice-print"
        className="mx-auto max-w-3xl"
      />
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
