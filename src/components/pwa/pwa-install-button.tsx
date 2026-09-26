"use client";

import { useState } from "react";
import { Download, Smartphone, X, Share } from "lucide-react";
import { usePWA } from "@/hooks/use-pwa";

export function PWAInstallButton({ className = "" }: { className?: string }) {
  const { isInstallable, isInstalled, isIOS, installApp } = usePWA();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  if (isInstalled) return null;

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSInstructions(true)}
          className={`glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wider text-[var(--color-copper)] border border-[var(--color-copper)]/30 hover:bg-[var(--color-copper)]/10 transition-colors ${className}`}
          title="Install BandsChamber Studio on iOS"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>Install App</span>
        </button>

        {showIOSInstructions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setShowIOSInstructions(false)}
                className="absolute top-4 right-4 rounded-lg p-1 text-[var(--color-sand-2)] hover:text-[var(--color-foreground)] transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="glass-pill flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-copper)]">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-foreground)]">Install BandsChamber Studio</h3>
                  <p className="text-xs text-[var(--color-sand-2)]">Add to your Home Screen</p>
                </div>
              </div>

              <ol className="space-y-3 text-xs text-[var(--color-foreground)] mb-5">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-[10px] font-bold">1</span>
                  <span>Tap the <Share className="inline h-3.5 w-3.5 text-sky-400 mx-0.5" /> <strong>Share</strong> button in Safari's bottom toolbar.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-[10px] font-bold">2</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-[10px] font-bold">3</span>
                  <span>Tap <strong>Add</strong> in the top-right corner.</span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSInstructions(false)}
                className="w-full rounded-xl bg-[var(--color-primary)] py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!isInstallable) return null;

  return (
    <button
      type="button"
      onClick={() => installApp()}
      className={`glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wider text-[var(--color-copper)] border border-[var(--color-copper)]/30 hover:bg-[var(--color-copper)]/10 transition-colors ${className}`}
      title="Install BandsChamber Studio as an App"
    >
      <Download className="h-3.5 w-3.5" />
      <span>Install App</span>
    </button>
  );
}
