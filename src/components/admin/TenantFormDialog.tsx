// Garage — create/edit tenant dialog for the Superadmin panel. Mirrors the
// seed shape: name, slug, currency, tax rate, plan, accent color and a single
// location. 100% local & simulated.

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
import { createTenant, updateTenant, type TenantInput } from "@/lib/admin";
import type { Plan, Tenant } from "@/types";
import { toast } from "sonner";

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: Plan[];
  /** When set, edits this tenant instead of creating one. */
  tenant?: Tenant | null;
  onSaved?: () => void;
}

const CURRENCIES = ["EUR", "MXN", "USD", "ZAR", "GBP", "ARS", "COP"];

const ACCENTS = [
  "#2F6FED",
  "#0F766E",
  "#B45309",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function TenantFormDialog({
  open,
  onOpenChange,
  plans,
  tenant,
  onSaved,
}: TenantFormDialogProps) {
  const isEdit = !!tenant;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [taxPct, setTaxPct] = useState("21");
  const [planId, setPlanId] = useState("");
  const [accentColor, setAccentColor] = useState(ACCENTS[0]);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (tenant) {
      setName(tenant.name);
      setSlug(tenant.slug);
      setCurrency(tenant.currency);
      setTaxPct(String(Math.round(tenant.taxRate * 100)));
      setPlanId(tenant.planId);
      setAccentColor(tenant.accentColor);
      setLocationName(tenant.locations[0]?.name ?? "");
      setLocationAddress(tenant.locations[0]?.address ?? "");
      setSlugTouched(true);
    } else {
      setName("");
      setSlug("");
      setCurrency("EUR");
      setTaxPct("21");
      setPlanId(plans[0]?.id ?? "");
      setAccentColor(ACCENTS[0]);
      setLocationName("");
      setLocationAddress("");
      setSlugTouched(false);
    }
  }, [open, tenant, plans]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = () => {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    if (!slug.trim()) return setError("El slug es obligatorio.");
    if (!planId) return setError("Selecciona un plan.");
    if (!locationName.trim())
      return setError("La ubicación es obligatoria.");

    const taxRate = Math.max(0, Math.min(100, Number(taxPct) || 0)) / 100;
    const input: TenantInput = {
      name,
      slug: slugify(slug),
      currency,
      taxRate,
      planId,
      accentColor,
      locationName,
      locationAddress,
    };

    if (isEdit && tenant) {
      updateTenant(tenant.id, input);
      toast.success("Taller actualizado");
    } else {
      createTenant(input);
      toast.success("Taller creado");
    }
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar taller" : "Nuevo taller"}</DialogTitle>
          <DialogDescription>
            Configura los datos del taller y su ubicación principal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Taller Reyes"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="reyes"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>IVA (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color de acento</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccentColor(c)}
                  aria-label={`Acento ${c}`}
                  className="h-8 w-8 rounded-md border-2 transition-transform hover:scale-105"
                  style={{
                    backgroundColor: c,
                    borderColor:
                      accentColor === c ? "var(--foreground)" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <Input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Ciudad de México"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Av. Insurgentes Sur 1234"
              />
            </div>
          </div>

          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEdit ? "Guardar cambios" : "Crear taller"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
