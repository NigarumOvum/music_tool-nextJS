"use client";

import { useEffect, useState } from "react";

import { Button, Spinner } from "@heroui/react";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { fetchSongs, runPromptOnSong } from "@/lib/music/client";
import type { MusicSongSummary } from "@/lib/music/types";

type PromptRunnerPanelProps = {
  templateId: string;
  templateName: string;
  targetLabel: string;
  defaultSongId?: string;
  onApplied?: (output: string) => void;
};

export function PromptRunnerPanel({
  templateId,
  templateName,
  targetLabel,
  defaultSongId,
  onApplied,
}: PromptRunnerPanelProps) {
  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [songId, setSongId] = useState(defaultSongId || "");
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const payload = await fetchSongs();
        if (cancelled) {
          return;
        }

        setSongs(payload.songs);
        if (defaultSongId && payload.songs.some((song) => song.id === defaultSongId)) {
          setSongId(defaultSongId);
        } else if (payload.songs[0]) {
          setSongId(payload.songs[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoadingSongs(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultSongId]);

  async function handleRun(apply: boolean) {
    if (!songId) {
      toast.error("Select a song first");
      return;
    }

    setRunning(true);
    try {
      const payload = await runPromptOnSong({ templateId, songId, apply });
      setOutput(payload.output);
      if (payload.applied) {
        toast.success(`Applied to ${targetLabel}`);
        onApplied?.(payload.output);
      } else {
        toast.success("Prompt completed");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="modal-inset-panel space-y-3 rounded-[1.25rem] p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--color-brass)]" />
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brass)]">
          Run prompt on song
        </div>
      </div>
      <p className="text-sm text-[var(--color-sand-2)]">
        Execute <span className="font-semibold text-[var(--color-foreground)]">{templateName}</span> against a song&apos;s{" "}
        <span className="font-semibold text-[var(--color-foreground)]">{targetLabel}</span> field using Ollama.
      </p>

      {loadingSongs ? (
        <div className="flex justify-center py-4"><Spinner size="sm" color="warning" /></div>
      ) : songs.length === 0 ? (
        <p className="text-sm text-[var(--color-sand-2)]">Create a song in Production Studio first.</p>
      ) : (
        <>
          <select className="field" value={songId} onChange={(event) => setSongId(event.target.value)}>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>{song.title}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button
              radius="full"
              variant="bordered"
              isDisabled={running}
              onPress={() => void handleRun(false)}
            >
              Preview result
            </Button>
            <Button
              className="bg-[var(--color-copper)] text-white"
              radius="full"
              isDisabled={running}
              onPress={() => void handleRun(true)}
            >
              {running ? "Running..." : "Run and apply"}
            </Button>
          </div>
        </>
      )}

      {output ? (
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)]">Output</span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(output);
                toast.success("Output copied");
              }}
              className="glass-pill inline-flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-widest"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-[1rem] border border-[var(--color-border)] bg-black/20 p-3 font-mono text-xs leading-6 text-[var(--color-foreground)]">
            {output}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
