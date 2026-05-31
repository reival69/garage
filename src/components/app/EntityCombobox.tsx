// Talleo — searchable single-select combobox. Lightweight (no cmdk) so it is
// predictable inside dialogs. Optionally offers a "create new" action.

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  sub?: string;
}

interface EntityComboboxProps {
  options: ComboOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  onCreateNew?: (query: string) => void;
  createLabel?: string;
  className?: string;
}

export function EntityCombobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados",
  disabled,
  onCreateNew,
  createLabel = "Crear nuevo",
  className,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = options.find((o) => o.value === value);
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter((o) =>
        `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(needle),
      )
    : options;

  const reset = () => {
    setOpen(false);
    setQ("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown strokeWidth={1.5} className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                reset();
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {o.label}
                </span>
                {o.sub && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {o.sub}
                  </span>
                )}
              </span>
              {o.value === value && (
                <Check strokeWidth={1.5} className="h-4 w-4 shrink-0" />
              )}
            </button>
          ))}
        </div>
        {onCreateNew && (
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={() => {
                onCreateNew(q.trim());
                reset();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Plus strokeWidth={1.5} className="h-4 w-4" />
              {createLabel}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
