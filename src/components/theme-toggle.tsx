"use client";

import { SunMoon } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:-translate-y-0.5"
      aria-label="Toggle theme"
    >
      <SunMoon className="h-4 w-4" />
      Theme
    </button>
  );
}