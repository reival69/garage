// Talleo — notification center. A bell with an unread badge that opens a panel
// listing notifications newest-first. Each item shows a type icon, title, body
// and relative time; unread items are visually distinct. Clicking one marks it
// read and navigates to its source entity. Desktop uses a popover; mobile uses
// a full-screen sheet. Everything is local & simulated.

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Calendar,
  FileText,
  Activity,
  BellRing,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  relativeTime,
} from "@/lib/notifications";
import type { AppNotification } from "@/types";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<AppNotification["type"], typeof Bell> = {
  cita: Calendar,
  presupuesto: FileText,
  estado: Activity,
  recordatorio: BellRing,
};

interface NotificationBellProps {
  variant: "popover" | "sheet";
}

export function NotificationBell({ variant }: NotificationBellProps) {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const tenantId = tenant?.id;

  const items = useMemo(
    () => (tenantId ? listNotifications(tenantId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId, version, open],
  );
  const unread = useMemo(
    () => (tenantId ? unreadCount(tenantId) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId, version, open],
  );

  if (!tenantId) return null;

  const handleClick = (n: AppNotification) => {
    if (!n.read) {
      markRead(tenantId, n.id);
      setVersion((v) => v + 1);
    }
    setOpen(false);
    if (n.link) navigate({ to: n.link as "/app" });
  };

  const handleMarkAll = () => {
    markAllRead(tenantId);
    setVersion((v) => v + 1);
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9"
      aria-label="Notificaciones"
    >
      <Bell strokeWidth={1.5} className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );

  const list = (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">Notificaciones</p>
        {unread > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <CheckCheck strokeWidth={1.5} className="h-3.5 w-3.5" />
            Marcar todas
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Bell
            strokeWidth={1.5}
            className="mx-auto mb-2 h-6 w-6 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">Sin notificaciones</p>
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto md:max-h-96">
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type];
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-background-subtle",
                  !n.read && "bg-background-subtle",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border",
                    !n.read ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon strokeWidth={1.5} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        !n.read
                          ? "font-medium text-foreground"
                          : "text-foreground",
                      )}
                    >
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                    {n.body}
                  </span>
                </span>
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (variant === "sheet") {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Notificaciones</SheetTitle>
          </SheetHeader>
          {list}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {list}
      </PopoverContent>
    </Popover>
  );
}
