"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Maximize2, Minimize2 } from "lucide-react";

type FullscreenContextValue = {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
};

const FullscreenContext = createContext<FullscreenContextValue>({
  isFullscreen: false,
  toggleFullscreen: () => undefined,
});

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => setIsFullscreen((prev) => !prev), []);

  // Keyboard shortcut: Cmd/Ctrl + F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "f" &&
        !e.shiftKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen, toggleFullscreen]);

  return (
    <FullscreenContext.Provider value={{ isFullscreen, toggleFullscreen }}>
      {children}
    </FullscreenContext.Provider>
  );
}

export function useFullscreen() {
  return useContext(FullscreenContext);
}

/** Button rendered next to the page title */
export function FullscreenTitleButton() {
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      title={isFullscreen ? "Exit Fullscreen (⌘F)" : "Fullscreen (⌘F)"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)] hover:border-[var(--color-copper)]"
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  );
}
