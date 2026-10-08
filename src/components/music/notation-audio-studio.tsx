"use client";

import { useState, useMemo, useCallback } from "react";
import { SplitViewFullScreen } from "@/components/split-view-fullscreen";
import { DawClient } from "@/components/music/daw-client";
import { TabStudioClient } from "@/components/music/tab-studio-client";
import { Music, Layers, Zap } from "lucide-react";

type ViewMode = "split" | "notation" | "audio";

export function NotationAudioStudio() {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [syncDirection, setSyncDirection] = useState<"midi-to-tab" | "tab-to-midi" | "none">("none");

  const canShowSplit = viewMode === "split";

  return (
    <SplitViewFullScreen
      className="space-y-4"
      showControls={false}
      allowSplitView={true}
    >
      {/* Control Bar */}
      <div className="panel glass-shine flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-lg font-black text-[var(--color-copper)]">
            <Layers className="h-5 w-5" />
            <span>Notation & Audio Studio</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 border-r border-white/10 pr-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)]">
              View
            </span>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                viewMode === "split"
                  ? "bg-[var(--color-mint)] text-black"
                  : "text-[var(--color-sand-2)] hover:text-white"
              }`}
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode("notation")}
              className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                viewMode === "notation"
                  ? "bg-[var(--color-mint)] text-black"
                  : "text-[var(--color-sand-2)] hover:text-white"
              }`}
            >
              Tab
            </button>
            <button
              type="button"
              onClick={() => setViewMode("audio")}
              className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                viewMode === "audio"
                  ? "bg-[var(--color-mint)] text-black"
                  : "text-[var(--color-sand-2)] hover:text-white"
              }`}
            >
              DAW
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)]">
              Sync
            </span>
            <button
              type="button"
              onClick={() => setSyncDirection("midi-to-tab")}
              className={`glass-pill flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                syncDirection === "midi-to-tab"
                  ? "bg-[var(--color-brass)] text-black"
                  : "text-[var(--color-sand-2)] hover:text-white"
              }`}
              title="Convert MIDI notes to tab notation"
            >
              <Music className="h-3 w-3" />
              MIDI→Tab
            </button>
            <button
              type="button"
              onClick={() => setSyncDirection("tab-to-midi")}
              className={`glass-pill flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                syncDirection === "tab-to-midi"
                  ? "bg-[var(--color-brass)] text-black"
                  : "text-[var(--color-sand-2)] hover:text-white"
              }`}
              title="Convert tab notation to MIDI notes"
            >
              <Zap className="h-3 w-3" />
              Tab→MIDI
            </button>
            <button
              type="button"
              onClick={() => setSyncDirection("none")}
              className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                syncDirection === "none"
                  ? "bg-[var(--color-copper)] text-black"
                  : "text-[var(--color-sand-2)] hover:text-white"
              }`}
            >
              Off
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-4">
        {viewMode === "split" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-black text-[var(--color-brass)]">
                <Music className="h-4 w-4" />
                <span>Tab Notation</span>
              </div>
              <div className="panel glass-shine rounded-[1.75rem] border border-white/10 p-4">
                <TabStudioClient />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-black text-[var(--color-mint)]">
                <Layers className="h-4 w-4" />
                <span>Audio DAW</span>
              </div>
              <div className="panel glass-shine rounded-[1.75rem] border border-white/10 p-4">
                <DawClient />
              </div>
            </div>
          </div>
        ) : viewMode === "notation" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-black text-[var(--color-brass)]">
              <Music className="h-4 w-4" />
              <span>Tab Notation</span>
            </div>
            <div className="panel glass-shine rounded-[1.75rem] border border-white/10 p-4">
              <TabStudioClient />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-black text-[var(--color-mint)]">
              <Layers className="h-4 w-4" />
              <span>Audio DAW</span>
            </div>
            <div className="panel glass-shine rounded-[1.75rem] border border-white/10 p-4">
              <DawClient />
            </div>
          </div>
        )}
      </div>

      {/* Sync Status Indicator */}
      {syncDirection !== "none" && (
        <div className="panel glass-shine flex items-center justify-between gap-4 rounded-[1.25rem] border border-[var(--color-brass)]/30 bg-[var(--color-brass)]/5 p-3">
          <div className="flex items-center gap-2 text-xs font-black text-[var(--color-brass)]">
            <Zap className="h-4 w-4" />
            <span>
              Sync Active: {syncDirection === "midi-to-tab" ? "MIDI → Tab" : "Tab → MIDI"}
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-sand-2)]">
            Changes in one view will automatically update the other
          </p>
        </div>
      )}
    </SplitViewFullScreen>
  );
}
