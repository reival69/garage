import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Tenant, User } from "@/types";
import { tenantsRepo, usersRepo } from "@/lib/db";
import { clearAll, flush, hydrate, mergeDocs, onSaveError, setPersister } from "@/lib/db/storage";
import {
  bootstrap,
  impersonate,
  login as loginFn,
  logout as logoutFn,
  stopImpersonating,
  syncDocs,
} from "@/lib/api/data.functions";

interface AuthValue {
  /** True once the data this page needs has been loaded from the server. */
  ready: boolean;
  user: User | null;
  tenant: Tenant | null;
  /** Logged in as a workshop by the superadmin (support mode). */
  impersonating: boolean;
  /** Real login with email and password. Returns an error message or null. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Superadmin only: open a workshop as one of its users. */
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  stopImpersonation: () => Promise<void>;
  /** Superadmin view: choose which workshop the /app screens show. */
  setActiveTenant: (tenantId: string) => void;
  /** Re-read the user and workshop from the loaded data (after editing them). */
  refresh: () => void;
  /** Reload everything from the server. */
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Customer and booking pages load their own data, keyed by the code or slug in the URL. */
function guestKey(pathname: string): string | null {
  const m = /^\/(c|v|t)\/([^/]+)\/?$/.exec(pathname);
  return m ? `${m[1]}:${m[2].toLowerCase()}` : null;
}

function currentPath() {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

class SaveError extends Error {
  retry: boolean;
  constructor(message: string, retry: boolean) {
    super(message);
    this.retry = retry;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const activeTenantId = useRef<string | null>(null);
  const loadedGuest = useRef(new Set<string>());

  const applyUser = useCallback((u: User | null) => {
    setUser(u);
    const tenantId = u?.tenantId ?? activeTenantId.current;
    setTenant(tenantId ? (tenantsRepo.getById(tenantId) ?? null) : null);
  }, []);

  const load = useCallback(
    async (path: string) => {
      await flush();
      const result = await bootstrap({ data: { path } });
      hydrate(result.docs);
      loadedGuest.current = new Set();
      const key = guestKey(path);
      if (key) loadedGuest.current.add(key);
      setImpersonating(result.impersonating);
      applyUser(result.user ? (usersRepo.getById(result.user.id) ?? result.user) : null);
    },
    [applyUser],
  );

  // Save every change to the server
  useEffect(() => {
    setPersister(async (ops) => {
      let result;
      try {
        result = await syncDocs({ data: { path: currentPath(), ops } });
      } catch (err) {
        throw new SaveError((err as Error).message || "Sin conexión", true);
      }
      if (!result.ok) throw new SaveError(result.error ?? "No se pudo guardar", false);
      return result.saved;
    });
    onSaveError((err) => {
      if ((err as SaveError).retry) {
        toast.error("Sin conexión con el servidor. Reintentando…", { id: "save-retry" });
      } else {
        toast.error((err as Error).message || "No se pudo guardar el cambio.");
        // Put the screen back in line with what the server really has
        void load(currentPath());
      }
    });
    return () => setPersister(null);
  }, [load]);

  // First load
  useEffect(() => {
    load(currentPath())
      .catch((err) => {
        console.error(err);
        toast.error("No se pudo conectar con el servidor.");
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening a customer or booking page after the first load
  useEffect(() => {
    const key = guestKey(pathname);
    if (!ready || !key || loadedGuest.current.has(key)) return;
    loadedGuest.current.add(key);
    setReady(false);
    bootstrap({ data: { path: pathname } })
      .then((result) => mergeDocs(result.docs))
      .catch((err) => console.error(err))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await loginFn({ data: { email, password } });
      if (!result.ok) return result.error;
      setReady(false);
      try {
        await load(currentPath());
      } finally {
        setReady(true);
      }
      return null;
    },
    [load],
  );

  const login = useCallback(
    async (target: User) => {
      await flush();
      const result = await impersonate({ data: { userId: target.id } });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo abrir el taller.");
        return;
      }
      setReady(false);
      try {
        await load(currentPath());
      } finally {
        setReady(true);
      }
    },
    [load],
  );

  const stopImpersonation = useCallback(async () => {
    await flush();
    await stopImpersonating();
    setReady(false);
    try {
      await load(currentPath());
    } finally {
      setReady(true);
    }
  }, [load]);

  const logout = useCallback(async () => {
    await flush();
    await logoutFn();
    clearAll();
    activeTenantId.current = null;
    setImpersonating(false);
    applyUser(null);
  }, [applyUser]);

  const setActiveTenant = useCallback((tenantId: string) => {
    activeTenantId.current = tenantId;
    setTenant(tenantsRepo.getById(tenantId) ?? null);
  }, []);

  const refresh = useCallback(() => {
    if (user) applyUser(usersRepo.getById(user.id) ?? user);
  }, [user, applyUser]);

  const reload = useCallback(() => load(currentPath()), [load]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      user,
      tenant,
      impersonating,
      signIn,
      login,
      logout,
      stopImpersonation,
      setActiveTenant,
      refresh,
      reload,
    }),
    [
      ready,
      user,
      tenant,
      impersonating,
      signIn,
      login,
      logout,
      stopImpersonation,
      setActiveTenant,
      refresh,
      reload,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {impersonating && user && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-foreground px-4 py-2 text-xs text-background">
          <span>
            Modo soporte: estás viendo el taller como <strong>{user.name}</strong>.
          </span>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => void stopImpersonation()}
          >
            Volver a superadmin
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
