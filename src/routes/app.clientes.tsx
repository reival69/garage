import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/clientes")({
  component: () => (
    <div>
      <PageHeader title="Clientes" description="Base de clientes del taller." />
      <EmptyState icon={Users} title="Próximamente" description="La gestión de clientes llegará en el siguiente prompt." />
    </div>
  ),
});
