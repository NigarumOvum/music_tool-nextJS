"use client";

import type { ReactNode } from "react";

import { HeroUIProvider } from "@heroui/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <HeroUIProvider>
      {children}
      <Toaster theme="dark" richColors position="top-right" />
    </HeroUIProvider>
  );
}