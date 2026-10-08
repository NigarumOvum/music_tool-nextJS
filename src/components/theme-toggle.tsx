"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="glass-pill inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:-translate-y-0.5"
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="h-3.5 w-3.5 text-[var(--color-brass)]" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-[var(--color-sand-2)]" />
      )}
    </button>
  );
}