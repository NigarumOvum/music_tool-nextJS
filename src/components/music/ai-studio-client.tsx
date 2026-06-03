"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Spinner } from "@heroui/react";
import { Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { createSong, enhanceContent, fetchSongDetail, fetchSongs, generateDraft, updateSong } from "@/lib/music/client";
import type { MusicSongDetail, MusicSongSummary } from "@/lib/music/types";

export function AiStudioClient() {
  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [selectedSong, setSelectedSong] = useState<MusicSongDetail | null>(null);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [loading, setLoading] = useState(true);
  const [generationForm, setGenerationForm] = useState({
    prompt: "A bilingual alt-rock single about persistence after a hard season.",
    genre: "Rock",
    language: "English",
    title: "",
    topic: "",
    emotion: "",
  });
  const [generatedDraft, setGeneratedDraft] = useState<Record<string, unknown> | null>(null);
  const [fieldName, setFieldName] = useState("lyrics_text");
  const [instructions, setInstructions] = useState("Tighten the hook and make the imagery more vivid without losing the current emotional arc.");
  const [enhancementPreview, setEnhancementPreview] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const payload = await fetchSongs();
        setSongs(payload.songs);
        if (payload.songs[0]) {
          const detail = await fetchSongDetail(payload.songs[0].id);
          setSelectedSong(detail.song);
          setSelectedSongId(payload.songs[0].id);
        }
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fieldValue = useMemo(() => {
    if (!selectedSong) {
      return "";
    }

    return String(selectedSong.song[fieldName as keyof typeof selectedSong.song] ?? "");
  }, [fieldName, selectedSong]);

  async function selectSong(songId: string) {
    setLoading(true);
    try {
      const payload = await fetchSongDetail(songId);
      setSelectedSong(payload.song);
      setSelectedSongId(songId);
      setEnhancementPreview(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    try {
      const payload = await generateDraft(generationForm as unknown as Record<string, unknown>);
      setGeneratedDraft(payload.draft);
      toast.success("Draft generated");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handleSaveGeneratedDraft() {
    if (!generatedDraft) {
      return;
    }

    try {
      const payload = await createSong(generatedDraft);
      toast.success("Draft saved as new song");
      const songsPayload = await fetchSongs();
      setSongs(songsPayload.songs);
      if (payload.song) {
        setSelectedSong(payload.song);
        setSelectedSongId(payload.song.song.id);
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handlePreviewEnhancement() {
    if (!selectedSong) {
      return;
    }

    try {
      const payload = await enhanceContent({
        targetType: "song-field",
        fieldName,
        currentValue: fieldValue,
        instructions,
        song: selectedSong.song,
      });
      setEnhancementPreview(payload.result);
      toast.success("Enhancement preview ready");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handleApplyEnhancement() {
    if (!selectedSong || !enhancementPreview?.updatedValue) {
      return;
    }

    try {
      const payload = await updateSong(selectedSong.song.id, {
        [fieldName]: enhancementPreview.updatedValue,
      });
      setSelectedSong(payload.song);
      setEnhancementPreview(null);
      toast.success("Enhancement applied");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel rounded-[1.75rem] p-5">
          <div className="eyebrow">Song generation</div>
          <h2 className="mt-2 text-3xl font-black">Draft a new song</h2>
          <div className="mt-4 space-y-3">
            <textarea className="field min-h-40" value={generationForm.prompt} onChange={(event) => setGenerationForm((current) => ({ ...current, prompt: event.target.value }))} />
            <div className="grid gap-3 md:grid-cols-3">
              <input className="field" value={generationForm.genre} onChange={(event) => setGenerationForm((current) => ({ ...current, genre: event.target.value }))} placeholder="Genre" />
              <input className="field" value={generationForm.language} onChange={(event) => setGenerationForm((current) => ({ ...current, language: event.target.value }))} placeholder="Language" />
              <input className="field" value={generationForm.emotion} onChange={(event) => setGenerationForm((current) => ({ ...current, emotion: event.target.value }))} placeholder="Emotion" />
            </div>
            <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={handleGenerate}>
              <Sparkles className="h-4 w-4" />
              Generate draft
            </Button>
            {generatedDraft ? (
              <>
                <pre className="rounded-[1.25rem] border border-white/8 bg-black/25 p-4 text-xs text-[var(--color-sand-2)]">{JSON.stringify(generatedDraft, null, 2)}</pre>
                <Button radius="full" variant="bordered" onPress={handleSaveGeneratedDraft}>Save draft to songs</Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="panel rounded-[1.75rem] p-5">
          <div className="eyebrow">Field enhancement</div>
          <h2 className="mt-2 text-3xl font-black">Rewrite a selected song field</h2>
          {loading ? (
            <div className="mt-6 flex justify-center"><Spinner color="warning" /></div>
          ) : (
            <div className="mt-4 space-y-3">
              <select className="field" value={selectedSongId} onChange={(event) => void selectSong(event.target.value)}>
                {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
              </select>
              <select className="field" value={fieldName} onChange={(event) => setFieldName(event.target.value)}>
                <option value="lyrics_text">lyrics_text</option>
                <option value="structure_text">structure_text</option>
                <option value="reference_text">reference_text</option>
                <option value="production_json">production_json</option>
              </select>
              <textarea className="field min-h-28" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
              <textarea className="field min-h-40" readOnly value={fieldValue} />
              <Button className="bg-[var(--color-berry)] text-white" radius="full" onPress={handlePreviewEnhancement}>
                <WandSparkles className="h-4 w-4" />
                Preview enhancement
              </Button>
              {enhancementPreview ? (
                <>
                  <pre className="rounded-[1.25rem] border border-white/8 bg-black/25 p-4 text-xs text-[var(--color-sand-2)]">{JSON.stringify(enhancementPreview, null, 2)}</pre>
                  <Button radius="full" variant="bordered" onPress={handleApplyEnhancement}>Apply preview</Button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}