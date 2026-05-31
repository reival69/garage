import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { openControlPanel } from "@/components/ControlPanel";

export const Route = createFileRoute("/panel")({
  component: PanelPage,
});

function PanelPage() {
  useEffect(() => {
    openControlPanel();
  }, []);

  return <div className="min-h-screen bg-background" />;
}
