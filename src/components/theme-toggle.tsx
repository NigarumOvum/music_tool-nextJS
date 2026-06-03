"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:-translate-y-0.5 dark:text-[var(--color-sand-1)]"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}