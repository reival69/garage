import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/facturacion")({
  component: () => (
    <div>
      <PageHeader title="Facturación" description="Facturas del taller." />
      <EmptyState icon={Receipt} title="No hay facturas" description="Todavía no se ha emitido ninguna factura." />
    </div>
  ),
});
