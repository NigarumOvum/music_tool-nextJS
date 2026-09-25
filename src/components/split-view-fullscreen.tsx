"use client";

import { useState, useCallback, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, Columns, X } from "lucide-react";

type SplitViewFullScreenProps = {
  children: ReactNode;
  secondaryContent?: ReactNode;
  defaultSplitView?: boolean;
  defaultFullscreen?: boolean;
  allowSplitView?: boolean;
  showControls?: boolean;
  className?: string;
};

export function SplitViewFullScreen({
  children,
  secondaryContent,
  defaultSplitView = false,
  defaultFullscreen = false,
  allowSplitView = true,
  showControls = true,
  className = "",
}: SplitViewFullScreenProps) {
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const [isSplitView, setIsSplitView] = useState(defaultSplitView);
  const [showSecondaryPanel, setShowSecondaryPanel] = useState(defaultSplitView);

  const toggleSplitView = useCallback(() => {
    setIsSplitView(!isSplitView);
    setShowSecondaryPanel(!isSplitView);
  }, [isSplitView]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Cmd/Ctrl + \: Toggle split view
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        if (allowSplitView) {
          toggleSplitView();
        }
        return;
      }

      // Cmd/Ctrl + F: Toggle fullscreen
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Escape: Exit fullscreen
      if (e.key === "Escape" && isFullscreen) {
        closeFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allowSplitView, toggleSplitView, toggleFullscreen, isFullscreen, closeFullscreen]);

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-50 m-0 h-screen w-screen rounded-none"
    : className;

  const content = (
    <div className={`flex flex-col ${containerClasses}`}>
      {showControls && (
        <div className="flex items-center justify-end gap-2 p-2">
          {allowSplitView && secondaryContent && (
            <button
              type="button"
              onClick={toggleSplitView}
              title={isSplitView ? "Exit Split View (⌘\\)" : "Split View (⌘\\)"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                isSplitView
                  ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10 text-[var(--color-brass)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Columns className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (⌘F)" : "Fullscreen (⌘F)"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              isFullscreen
                ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10 text-[var(--color-brass)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {isFullscreen && (
            <button
              type="button"
              onClick={closeFullscreen}
              title="Close Fullscreen (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className={`flex-1 ${isSplitView && showSecondaryPanel ? 'flex gap-4' : ''}`}>
        <div className={isSplitView && showSecondaryPanel ? 'flex-1 overflow-y-auto' : ''}>
          {children}
        </div>
        {isSplitView && showSecondaryPanel && secondaryContent && (
          <div className="flex-1 overflow-y-auto border-l border-[var(--color-stroke)] pl-4">
            {secondaryContent}
          </div>
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[var(--color-background)]"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }

  return content;
}
