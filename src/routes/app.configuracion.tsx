import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/configuracion")({
  component: () => (
    <div>
      <PageHeader title="Configuración" description="Ajustes del taller." />
      <EmptyState icon={Settings} title="Próximamente" description="La configuración llegará en el siguiente prompt." />
    </div>
  ),
});
