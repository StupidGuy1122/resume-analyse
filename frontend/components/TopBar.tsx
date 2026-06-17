"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

/** Slim top bar shown on every authenticated page. Hidden on /login. */
export function TopBar() {
  const pathname = usePathname();
  const { state, logout } = useAuth();

  if (pathname === "/login") return null;
  if (state.status !== "authed") return null;

  return (
    <div className="sticky top-0 z-50 border-b border-foreground/30 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3 lg:px-10">
        <Link href="/" className="group flex items-baseline gap-3">
          <span className="font-display text-[22px] tracking-tight text-foreground">
            resume<span className="proof-mark">·</span>analyse
          </span>
          <span className="hidden font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
            The Proof Room
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground sm:inline-flex">
            <span className="h-1 w-1 rounded-full bg-foreground" />
            {state.username}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
