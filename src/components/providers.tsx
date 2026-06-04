"use client";

import type { ReactNode } from "react";

import { HeroUIProvider } from "@heroui/react";
import { Toaster } from "sonner";

import { ThemeProvider, useTheme } from "@/components/theme-provider";

import { AudioProvider } from "@/components/music/audio-provider";

function ProviderContent({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <HeroUIProvider>
      <AudioProvider>
        {children}
      </AudioProvider>
      <Toaster theme={theme} richColors position="top-right" />
    </HeroUIProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ProviderContent>{children}</ProviderContent>
    </ThemeProvider>
  );
}