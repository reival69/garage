import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Tenant, User } from "@/types";
import { tenantsRepo, usersRepo } from "@/lib/db";
import { seedIfEmpty } from "@/lib/db";
import { readRaw, writeRaw } from "@/lib/db/storage";

interface Session {
  userId: string;
  tenantId: string | null;
}

interface AuthValue {
  ready: boolean;
  user: User | null;
  tenant: Tenant | null;
  /** Simulated login — any user object is accepted, no real validation. */
  login: (user: User) => void;
  logout: () => void;
  /** Switch the active tenant (demo switcher). */
  setActiveTenant: (tenantId: string) => void;
  /** Re-read everything from storage (after resetDemo). */
  refresh: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const SESSION_KEY = "session";

function loadSession(): Session | null {
  const raw = readRaw(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  writeRaw(SESSION_KEY, session ? JSON.stringify(session) : "");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const hydrate = () => {
    const session = loadSession();
    if (session) {
      const u = usersRepo.getById(session.userId) ?? null;
      setUser(u);
      setTenant(session.tenantId ? (tenantsRepo.getById(session.tenantId) ?? null) : null);
    } else {
      setUser(null);
      setTenant(null);
    }
  };

  useEffect(() => {
    // Client-only: seed demo data and restore the session.
    seedIfEmpty();
    hydrate();
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (u: User) => {
    setUser(u);
    const t = u.tenantId ? (tenantsRepo.getById(u.tenantId) ?? null) : null;
    setTenant(t);
    saveSession({ userId: u.id, tenantId: u.tenantId });
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    saveSession(null);
  };

  const setActiveTenant = (tenantId: string) => {
    const t = tenantsRepo.getById(tenantId) ?? null;
    setTenant(t);
    if (user) saveSession({ userId: user.id, tenantId });
  };

  const refresh = () => hydrate();

  const value = useMemo<AuthValue>(
    () => ({ ready, user, tenant, login, logout, setActiveTenant, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, user, tenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
