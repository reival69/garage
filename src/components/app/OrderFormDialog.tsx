// Garage — create work order dialog. Lets you pick existing customer + vehicle
// (with search) or create them inline. Creates the order via the orders helper
// so the access code, notification and initial message are all generated.

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox } from "@/components/app/EntityCombobox";
import { customersRepo, vehiclesRepo } from "@/lib/db";
import { createWorkOrder, listMechanics } from "@/lib/orders";
import type { Customer, Tenant, Vehicle, WorkOrder } from "@/types";
import { toast } from "sonner";

interface OrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant;
  defaultCustomerId?: string;
  defaultVehicleId?: string;
  onCreated?: (order: WorkOrder) => void;
}

export function OrderFormDialog({
  open,
  onOpenChange,
  tenant,
  defaultCustomerId,
  defaultVehicleId,
  onCreated,
}: OrderFormDialogProps) {
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [mechanicId, setMechanicId] = useState("");
  const [problem, setProblem] = useState("");

  // Inline creation state
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [creatingVehicle, setCreatingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    plate: "",
    make: "",
    model: "",
  });

  const [error, setError] = useState("");

  const customers = useMemo(
    () => (open ? customersRepo.list(tenant.id) : []),
    [open, tenant.id],
  );
  const allVehicles = useMemo(
    () => (open ? vehiclesRepo.list(tenant.id) : []),
    [open, tenant.id],
  );
  const mechanics = useMemo(
    () => (open ? listMechanics(tenant.id) : []),
    [open, tenant.id],
  );

  useEffect(() => {
    if (!open) return;
    setCustomerId(defaultCustomerId ?? "");
    setVehicleId(defaultVehicleId ?? "");
    setMechanicId(mechanics[0]?.id ?? "");
    setProblem("");
    setCreatingCustomer(false);
    setNewCustomer({ name: "", phone: "" });
    setCreatingVehicle(false);
    setNewVehicle({ plate: "", make: "", model: "" });
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCustomerId, defaultVehicleId]);

  const vehiclesForCustomer = creatingCustomer
    ? []
    : allVehicles.filter((v) => v.customerId === customerId);

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
    sub: c.phone,
  }));
  const vehicleOptions = vehiclesForCustomer.map((v) => ({
    value: v.id,
    label: `${v.make} ${v.model}`.trim() || v.plate,
    sub: v.plate,
  }));

  const startCreateCustomer = (query: string) => {
    setCreatingCustomer(true);
    setNewCustomer({ name: query, phone: "" });
    setCustomerId("");
    setVehicleId("");
    setCreatingVehicle(true); // new customer has no vehicles yet
  };

  const startCreateVehicle = (query: string) => {
    setCreatingVehicle(true);
    setNewVehicle({ plate: query, make: "", model: "" });
    setVehicleId("");
  };

  const submit = () => {
    setError("");

    // Resolve customer
    let resolvedCustomer: Customer | undefined;
    if (creatingCustomer) {
      if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
        setError("El nuevo cliente necesita nombre y teléfono.");
        return;
      }
      resolvedCustomer = customersRepo.create(tenant.id, {
        tenantId: tenant.id,
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        createdAt: new Date().toISOString(),
      } as Omit<Customer, "id">);
    } else {
      if (!customerId) {
        setError("Selecciona un cliente.");
        return;
      }
      resolvedCustomer = customers.find((c) => c.id === customerId);
    }
    if (!resolvedCustomer) {
      setError("No se pudo resolver el cliente.");
      return;
    }

    // Resolve vehicle
    let resolvedVehicle: Vehicle | undefined;
    if (creatingVehicle) {
      if (!newVehicle.plate.trim()) {
        setError("El nuevo vehículo necesita matrícula.");
        return;
      }
      resolvedVehicle = vehiclesRepo.create(tenant.id, {
        tenantId: tenant.id,
        customerId: resolvedCustomer.id,
        plate: newVehicle.plate.trim().toUpperCase(),
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        year: 0,
        km: 0,
      } as Omit<Vehicle, "id">);
    } else {
      if (!vehicleId) {
        setError("Selecciona un vehículo.");
        return;
      }
      resolvedVehicle = allVehicles.find((v) => v.id === vehicleId);
    }
    if (!resolvedVehicle) {
      setError("No se pudo resolver el vehículo.");
      return;
    }

    if (!problem.trim()) {
      setError("Describe el problema o motivo de entrada.");
      return;
    }

    const order = createWorkOrder(tenant, {
      customerId: resolvedCustomer.id,
      vehicleId: resolvedVehicle.id,
      mechanicId: mechanicId || undefined,
      problemDescription: problem.trim(),
    });

    toast.success(`Orden creada · ${order.accessCode}`);
    onCreated?.(order);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva orden</DialogTitle>
          <DialogDescription>
            Selecciona cliente y vehículo, o créalos al momento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer */}
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            {creatingCustomer ? (
              <div className="space-y-2 rounded-lg border border-border bg-background-subtle p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Nuevo cliente
                  </span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setCreatingCustomer(false);
                      setCreatingVehicle(false);
                    }}
                  >
                    Usar existente
                  </button>
                </div>
                <Input
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer((c) => ({ ...c, name: e.target.value }))
                  }
                  placeholder="Nombre *"
                  maxLength={120}
                />
                <Input
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer((c) => ({ ...c, phone: e.target.value }))
                  }
                  placeholder="Teléfono *"
                  maxLength={30}
                />
              </div>
            ) : (
              <EntityCombobox
                options={customerOptions}
                value={customerId}
                onChange={(v) => {
                  setCustomerId(v);
                  setVehicleId("");
                }}
                placeholder="Seleccionar cliente…"
                emptyText="No hay clientes"
                onCreateNew={startCreateCustomer}
                createLabel="Crear cliente nuevo"
              />
            )}
          </div>

          {/* Vehicle */}
          <div className="space-y-1.5">
            <Label>Vehículo *</Label>
            {creatingVehicle ? (
              <div className="space-y-2 rounded-lg border border-border bg-background-subtle p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Nuevo vehículo
                  </span>
                  {!creatingCustomer && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setCreatingVehicle(false)}
                    >
                      Usar existente
                    </button>
                  )}
                </div>
                <Input
                  value={newVehicle.plate}
                  onChange={(e) =>
                    setNewVehicle((v) => ({ ...v, plate: e.target.value }))
                  }
                  placeholder="Matrícula *"
                  maxLength={15}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={newVehicle.make}
                    onChange={(e) =>
                      setNewVehicle((v) => ({ ...v, make: e.target.value }))
                    }
                    placeholder="Marca"
                    maxLength={40}
                  />
                  <Input
                    value={newVehicle.model}
                    onChange={(e) =>
                      setNewVehicle((v) => ({ ...v, model: e.target.value }))
                    }
                    placeholder="Modelo"
                    maxLength={40}
                  />
                </div>
              </div>
            ) : (
              <EntityCombobox
                options={vehicleOptions}
                value={vehicleId}
                onChange={setVehicleId}
                placeholder={
                  customerId
                    ? "Seleccionar vehículo…"
                    : "Elige primero un cliente"
                }
                emptyText="Sin vehículos para este cliente"
                disabled={!customerId}
                onCreateNew={startCreateVehicle}
                createLabel="Crear vehículo nuevo"
              />
            )}
          </div>

          {/* Mechanic */}
          <div className="space-y-1.5">
            <Label>Mecánico asignado</Label>
            <Select value={mechanicId} onValueChange={setMechanicId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {mechanics.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Problem */}
          <div className="space-y-1.5">
            <Label htmlFor="o-problem">Problema / motivo *</Label>
            <Textarea
              id="o-problem"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe el motivo de entrada…"
              maxLength={600}
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Crear orden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
