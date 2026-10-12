// Garage — edit plan dialog for the Superadmin panel. Name, tier, monthly price
// and limits (orders, users, photos per order). 100% local & simulated.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePlan } from "@/lib/admin";
import type { Plan, PlanTier } from "@/types";
import { toast } from "sonner";

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  onSaved?: () => void;
}

const TIERS: PlanTier[] = ["basico", "pro", "premium"];

export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
  onSaved,
}: PlanFormDialogProps) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState<PlanTier>("basico");
  const [price, setPrice] = useState("0");
  const [maxOrders, setMaxOrders] = useState("0");
  const [maxUsers, setMaxUsers] = useState("0");
  const [maxPhotos, setMaxPhotos] = useState("0");

  useEffect(() => {
    if (!open || !plan) return;
    setName(plan.name);
    setTier(plan.tier);
    setPrice(String(plan.priceMonthly));
    setMaxOrders(String(plan.limits.maxOrders));
    setMaxUsers(String(plan.limits.maxUsers));
    setMaxPhotos(String(plan.limits.maxPhotosPerOrder));
  }, [open, plan]);

  const handleSubmit = () => {
    if (!plan) return;
    updatePlan(plan.id, {
      name: name.trim() || plan.name,
      tier,
      priceMonthly: Math.max(0, Number(price) || 0),
      limits: {
        maxOrders: Math.max(0, Number(maxOrders) || 0),
        maxUsers: Math.max(0, Number(maxUsers) || 0),
        maxPhotosPerOrder: Math.max(0, Number(maxPhotos) || 0),
      },
    });
    toast.success("Plan actualizado");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
          <DialogDescription>
            Ajusta el precio mensual y los límites del plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as PlanTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Precio mensual (€)</Label>
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Máx. órdenes</Label>
              <Input
                type="number"
                min={0}
                value={maxOrders}
                onChange={(e) => setMaxOrders(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. usuarios</Label>
              <Input
                type="number"
                min={0}
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fotos/orden</Label>
              <Input
                type="number"
                min={0}
                value={maxPhotos}
                onChange={(e) => setMaxPhotos(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
