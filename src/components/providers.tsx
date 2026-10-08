"use client";

import type { ReactNode } from "react";

import { HeroUIProvider } from "@heroui/react";
import { Toaster } from "sonner";

import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { AudioProvider } from "@/components/music/audio-provider";
import { FullscreenProvider } from "@/components/fullscreen-context";
import { PWAOfflineIndicator } from "@/components/pwa/pwa-offline-indicator";

function ProviderContent({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <HeroUIProvider>
      <LanguageProvider>
        <AudioProvider>
          <FullscreenProvider>
            {children}
          </FullscreenProvider>
        </AudioProvider>
      </LanguageProvider>
      <PWAOfflineIndicator />
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