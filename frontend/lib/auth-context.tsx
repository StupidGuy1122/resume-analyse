"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getMe, login as apiLogin, logout as apiLogout } from "@/lib/api";

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "authed"; username: string };

type AuthCtx = {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const PUBLIC_PATHS = ["/login"];

/**
 * Global auth provider — checks /api/auth/me on mount, and redirects:
 *   - any authenticated user landing on /login → "/"
 *   - any anon user landing on a non-public page → "/login"
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      if (me.authenticated && me.username) {
        setState({ status: "authed", username: me.username });
      } else {
        setState({ status: "anon" });
      }
    } catch {
      setState({ status: "anon" });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Redirect logic
  useEffect(() => {
    if (state.status === "loading") return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (state.status === "anon" && !isPublic) {
      router.replace("/login");
    } else if (state.status === "authed" && pathname === "/login") {
      router.replace("/");
    }
  }, [state, pathname, router]);

  const login = useCallback(async (username: string, password: string) => {
    await apiLogin(username, password);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ status: "anon" });
    router.replace("/login");
  }, [router]);

  return <Ctx.Provider value={{ state, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside <AuthProvider>");
  return v;
}
