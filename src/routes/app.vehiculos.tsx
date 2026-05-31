import { createFileRoute } from "@tanstack/react-router";
import { Car } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/vehiculos")({
  component: () => (
    <div>
      <PageHeader title="Vehículos" description="Vehículos registrados." />
      <EmptyState icon={Car} title="Próximamente" description="La gestión de vehículos llegará en el siguiente prompt." />
    </div>
  ),
});
