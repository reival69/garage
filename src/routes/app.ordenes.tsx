import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/ordenes")({
  component: () => (
    <div>
      <PageHeader title="Órdenes" description="Órdenes de reparación." />
      <EmptyState icon={ClipboardList} title="Próximamente" description="La gestión de órdenes llegará en el siguiente prompt." />
    </div>
  ),
});
