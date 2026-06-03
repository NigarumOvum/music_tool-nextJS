"use client";

import { useRouter } from "next/navigation";

import { LogOut } from "lucide-react";
import { toast } from "sonner";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      toast.error("Failed to log out");
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-foreground)] transition hover:-translate-y-0.5 hover:border-rose-400/60"
    >
      <LogOut className="h-3.5 w-3.5" />
      Logout
    </button>
  );
}