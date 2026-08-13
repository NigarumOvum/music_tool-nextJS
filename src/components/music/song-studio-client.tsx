"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import {
  Disc3,
  FileJson,
  Layers3,
  Music2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";

import { useProductionSong } from "@/components/music/production-song-context";
import { PromptRunnerPanel } from "@/components/music/prompt-runner-panel";
import {
  createSong,
  deleteSong,
  deleteSongPart,
  fetchSongDetail,
  fetchSongs,
  fetchTemplates,
  saveSongPart,
  updateSong,
} from "@/lib/music/client";
import type { MusicSongDetail, MusicSongSummary, MusicTaskTemplateRecord } from "@/lib/music/types";

type EditorTab = "overview" | "lyrics" | "arrangement" | "advanced";
type PartKind = "section" | "layer";

function emptyPart() {
  return { name: "", text: "", json: "{}" };
}

function formatSavedAt(value: string | null) {
  if (!value) return "Not saved";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function FieldGroup({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`field-group ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function patchSong(
  current: MusicSongDetail | null,
  patch: Partial<MusicSongDetail["song"]>,
): MusicSongDetail | null {
  if (!current) return current;
  return { ...current, song: { ...current.song, ...patch } };
}

export function SongStudioClient() {
  const { selectedSongId: hubSongId, setSelectedSongId: setHubSongId, refreshSongs } = useProductionSong();

  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [selectedSong, setSelectedSong] = useState<MusicSongDetail | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editorTab, setEditorTab] = useState<EditorTab>("overview");
  const [newSection, setNewSection] = useState(emptyPart());
  const [newLayer, setNewLayer] = useState(emptyPart());
  const [promptTemplates, setPromptTemplates] = useState<MusicTaskTemplateRecord[]>([]);
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const bootedRef = useRef(false);
  const { isOpen: deleteOpen, onOpen: openDelete, onOpenChange: onDeleteOpenChange, onClose: closeDelete } = useDisclosure();

  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter((song) =>
      [song.title, song.genre, song.language, song.emotion, song.topic]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [search, songs]);

  const isDirty = useMemo(() => {
    if (!selectedSong) return false;
    return JSON.stringify(selectedSong) !== savedSnapshot;
  }, [savedSnapshot, selectedSong]);

  const activePromptTemplate = useMemo(
    () => promptTemplates.find((template) => template.id === selectedPromptTemplateId) || null,
    [promptTemplates, selectedPromptTemplateId],
  );

  async function loadLibrary(nextSelectedId?: string, showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const payload = await fetchSongs(search);
      setSongs(payload.songs);
      const preferredId = nextSelectedId || selectedSongId || hubSongId || payload.songs[0]?.id || "";
      if (preferredId) {
        await selectSong(preferredId, false);
      } else {
        setSelectedSong(null);
        setSelectedSongId("");
        setSavedSnapshot("");
      }
      await refreshSongs();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  async function selectSong(songId: string, showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const payload = await fetchSongDetail(songId);
      setSelectedSong(payload.song);
      setSelectedSongId(songId);
      setSavedSnapshot(JSON.stringify(payload.song));
      setHubSongId(songId);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const payload = await fetchSongs();
        if (cancelled) return;
        setSongs(payload.songs);
        const preferredId = hubSongId || payload.songs[0]?.id || "";
        if (preferredId) {
          const detail = await fetchSongDetail(preferredId);
          if (cancelled) return;
          setSelectedSong(detail.song);
          setSelectedSongId(preferredId);
          setSavedSnapshot(JSON.stringify(detail.song));
        }
      } catch (error) {
        if (!cancelled) toast.error((error as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    void fetchTemplates()
      .then((payload) => {
        if (cancelled) return;
        setPromptTemplates(payload.templates);
        if (payload.templates[0]) setSelectedPromptTemplateId(payload.templates[0].id);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [hubSongId]);

  useEffect(() => {
    if (!hubSongId || hubSongId === selectedSongId || loading) return;
    void selectSong(hubSongId, false);
  }, [hubSongId]);

  async function saveSongFields() {
    if (!selectedSong) return;
    setSaving(true);
    try {
      const payload = await updateSong(selectedSong.song.id, selectedSong.song as unknown as Record<string, unknown>);
      setSelectedSong(payload.song);
      setSavedSnapshot(JSON.stringify(payload.song));
      toast.success("Song saved");
      await loadLibrary(selectedSong.song.id, false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function createDraftSong() {
    try {
      const payload = await createSong({ title: `Untitled sketch ${new Date().toLocaleDateString()}` });
      toast.success("Song created");
      await loadLibrary(payload.song?.song.id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function confirmDeleteSong(song: { id: string; title: string }) {
    setDeleteTarget(song);
    openDelete();
  }

  async function removeSong() {
    if (!deleteTarget) return;
    try {
      await deleteSong(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.title}"`);
      closeDelete();
      setDeleteTarget(null);
      const remaining = songs.filter((song) => song.id !== deleteTarget.id);
      setSongs(remaining);
      const nextId = remaining[0]?.id || "";
      if (nextId) {
        await selectSong(nextId);
      } else {
        setSelectedSong(null);
        setSelectedSongId("");
        setSavedSnapshot("");
      }
      await refreshSongs();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function persistPart(kind: PartKind, part: { name: string; text: string | null; json: string }) {
    if (!selectedSong) return;
    try {
      const payload = await saveSongPart(selectedSong.song.id, {
        kind,
        name: part.name,
        text: part.text,
        json: part.json,
      });
      setSelectedSong(payload.song);
      setSavedSnapshot(JSON.stringify(payload.song));
      toast.success(`${kind} saved`);
      await loadLibrary(selectedSong.song.id, false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function removePart(kind: PartKind, name: string) {
    if (!selectedSong) return;
    try {
      const payload = await deleteSongPart(selectedSong.song.id, { kind, name });
      setSelectedSong(payload.song);
      setSavedSnapshot(JSON.stringify(payload.song));
      toast.success(`${kind} deleted`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const editorTabs: Array<{ id: EditorTab; label: string; icon: typeof Music2 }> = [
    { id: "overview", label: "Overview", icon: Music2 },
    { id: "lyrics", label: "Lyrics", icon: Type },
    { id: "arrangement", label: "Arrangement", icon: Layers3 },
    { id: "advanced", label: "Advanced", icon: FileJson },
  ];

  return (
    <div className="page-grid animate-fade-up">
      <aside className="panel glass-shine rounded-[1.75rem] p-4">
        <div className="space-y-4">
          <div>
            <div className="eyebrow">Library</div>
            <h2 className="mt-2 text-2xl font-black">Songs</h2>
            <p className="mt-1 text-xs text-[var(--color-sand-2)]">{songs.length} in workspace</p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-sand-2)]" />
            <input
              className="field pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadLibrary();
              }}
              placeholder="Search title, genre, mood..."
            />
          </div>

          <div className="flex gap-2">
            <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={() => void loadLibrary()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="bordered" radius="full" onPress={() => void createDraftSong()}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>

          <div className="max-h-[68vh] space-y-2 overflow-auto pr-1 stagger-children">
            {filteredSongs.map((song) => (
              <div
                key={song.id}
                className={`song-list-item group flex items-start gap-2 rounded-[1.25rem] px-3 py-3 ${
                  selectedSongId === song.id ? "song-list-item-active" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void selectSong(song.id)}
                  type="button"
                >
                  <div className="truncate text-sm font-black text-[var(--color-sand-1)]">{song.title}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {song.genre ? <Chip size="sm" variant="flat">{song.genre}</Chip> : null}
                    {song.bpm ? <Chip size="sm" variant="flat">{song.bpm} BPM</Chip> : null}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-sand-2)]">
                    {song.section_count} sections · {song.layer_count} layers
                  </div>
                </button>
                <button
                  aria-label={`Delete ${song.title}`}
                  className="glass-pill mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-[var(--color-sand-2)] opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  onClick={() => confirmDeleteSong(song)}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {filteredSongs.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-white/10 px-4 py-6 text-center text-sm text-[var(--color-sand-2)]">
                No songs match your search.
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <section className="space-y-5">
        {loading ? (
          <div className="panel flex min-h-[360px] items-center justify-center rounded-[1.75rem] p-6">
            <Spinner color="warning" />
          </div>
        ) : selectedSong ? (
          <>
            <div className="panel glass-shine rounded-[1.75rem] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Song editor</div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">{selectedSong.song.title}</h2>
                  <p className="mt-1 text-xs text-[var(--color-sand-2)]">
                    Last saved {formatSavedAt(selectedSong.song.saved_at)}
                    {isDirty ? " · Unsaved changes" : " · Up to date"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    radius="full"
                    variant="bordered"
                    color="danger"
                    onPress={() => confirmDeleteSong({ id: selectedSong.song.id, title: selectedSong.song.title })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    className={`bg-[var(--color-copper)] text-white ${isDirty ? "animate-[glow-pulse_2s_ease-in-out_infinite]" : ""}`}
                    radius="full"
                    isLoading={saving}
                    onPress={() => void saveSongFields()}
                  >
                    <Save className="h-4 w-4" />
                    Save song
                  </Button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {editorTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={`tab-editor-pill inline-flex items-center gap-2 ${editorTab === tab.id ? "tab-editor-pill-active" : ""}`}
                      onClick={() => setEditorTab(tab.id)}
                      type="button"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {promptTemplates.length > 0 && activePromptTemplate ? (
              <div className="panel glass-shine animate-fade-up rounded-[1.75rem] p-5 space-y-3">
                <div className="eyebrow">AI prompts</div>
                <select
                  className="field"
                  value={selectedPromptTemplateId}
                  onChange={(event) => setSelectedPromptTemplateId(event.target.value)}
                >
                  {promptTemplates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                <PromptRunnerPanel
                  templateId={activePromptTemplate.id}
                  templateName={activePromptTemplate.name}
                  targetLabel={activePromptTemplate.targetField || "song field"}
                  defaultSongId={selectedSongId}
                  onApplied={() => void selectSong(selectedSongId)}
                />
              </div>
            ) : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={editorTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="panel glass-shine rounded-[1.75rem] p-5"
              >
                {editorTab === "overview" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup label="Title">
                      <input
                        className="field"
                        value={selectedSong.song.title}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { title: event.target.value }))}
                        placeholder="Song title"
                      />
                    </FieldGroup>
                    <FieldGroup label="Genre">
                      <input
                        className="field"
                        value={selectedSong.song.genre ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { genre: event.target.value }))}
                        placeholder="Pop, Rock, Cumbia..."
                      />
                    </FieldGroup>
                    <FieldGroup label="Language">
                      <input
                        className="field"
                        value={selectedSong.song.language ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { language: event.target.value }))}
                        placeholder="Spanish, English..."
                      />
                    </FieldGroup>
                    <FieldGroup label="Emotion / mood">
                      <input
                        className="field"
                        value={selectedSong.song.emotion ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { emotion: event.target.value }))}
                        placeholder="Nostalgic, energetic..."
                      />
                    </FieldGroup>
                    <FieldGroup label="BPM">
                      <input
                        className="field"
                        value={String(selectedSong.song.bpm ?? "")}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { bpm: Number(event.target.value) || null }))}
                        placeholder="120"
                        type="number"
                      />
                    </FieldGroup>
                    <FieldGroup label="Musical key">
                      <input
                        className="field"
                        value={selectedSong.song.musical_key ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { musical_key: event.target.value }))}
                        placeholder="Am, C major..."
                      />
                    </FieldGroup>
                    <FieldGroup label="Topic" className="md:col-span-2">
                      <input
                        className="field"
                        value={selectedSong.song.topic ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { topic: event.target.value }))}
                        placeholder="What is this song about?"
                      />
                    </FieldGroup>
                    <FieldGroup label="Hook summary" className="md:col-span-2">
                      <textarea
                        className="field min-h-24"
                        value={selectedSong.song.hook_summary ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { hook_summary: event.target.value }))}
                        placeholder="One-line hook or chorus idea"
                      />
                    </FieldGroup>
                    <FieldGroup label="Vocal style">
                      <input
                        className="field"
                        value={selectedSong.song.vocal_style ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { vocal_style: event.target.value }))}
                        placeholder="Breathy, belted, rap..."
                      />
                    </FieldGroup>
                    <FieldGroup label="Instrumentation">
                      <input
                        className="field"
                        value={selectedSong.song.instrumentation ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { instrumentation: event.target.value }))}
                        placeholder="Acoustic guitar, synth pads..."
                      />
                    </FieldGroup>
                  </div>
                ) : null}

                {editorTab === "lyrics" ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FieldGroup label="Lyrics">
                      <textarea
                        className="field min-h-80 font-mono text-sm leading-6"
                        value={selectedSong.song.lyrics_text ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { lyrics_text: event.target.value }))}
                        placeholder="Write or paste lyrics here..."
                      />
                    </FieldGroup>
                    <FieldGroup label="Structure notes">
                      <textarea
                        className="field min-h-80"
                        value={selectedSong.song.structure_text ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { structure_text: event.target.value }))}
                        placeholder="Intro → Verse → Chorus → Bridge..."
                      />
                    </FieldGroup>
                    <FieldGroup label="Reference text" className="lg:col-span-2">
                      <textarea
                        className="field min-h-32"
                        value={selectedSong.song.reference_text ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { reference_text: event.target.value }))}
                        placeholder="Reference track notes, inspiration..."
                      />
                    </FieldGroup>
                  </div>
                ) : null}

                {editorTab === "arrangement" ? (
                  <div className="grid gap-6 xl:grid-cols-2">
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <Disc3 className="h-4 w-4 text-[var(--color-brass)]" />
                        <h3 className="text-xl font-black">Sections</h3>
                      </div>
                      <div className="space-y-3">
                        {selectedSong.sections.map((section) => (
                          <div key={section.name} className="glass-card-soft rounded-[1.25rem] p-4">
                            <FieldGroup label="Section name">
                              <input
                                className="field"
                                value={section.name}
                                onChange={(event) => setSelectedSong((current) => current ? {
                                  ...current,
                                  sections: current.sections.map((item) => item.name === section.name ? { ...item, name: event.target.value } : item),
                                } : current)}
                              />
                            </FieldGroup>
                            <FieldGroup label="Notes" className="mt-3">
                              <textarea
                                className="field min-h-24"
                                value={section.text ?? ""}
                                onChange={(event) => setSelectedSong((current) => current ? {
                                  ...current,
                                  sections: current.sections.map((item) => item.name === section.name ? { ...item, text: event.target.value } : item),
                                } : current)}
                              />
                            </FieldGroup>
                            <div className="mt-3 flex gap-2">
                              <Button radius="full" className="bg-[var(--color-copper)] text-white" onPress={() => void persistPart("section", section)}>Save</Button>
                              <Button radius="full" variant="bordered" color="danger" onPress={() => void removePart("section", section.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="rounded-[1.25rem] border border-dashed border-white/12 p-4">
                          <div className="mb-3 text-sm font-semibold">Add section</div>
                          <input className="field mb-3" value={newSection.name} onChange={(event) => setNewSection((current) => ({ ...current, name: event.target.value }))} placeholder="verse_1" />
                          <textarea className="field mb-3 min-h-20" value={newSection.text} onChange={(event) => setNewSection((current) => ({ ...current, text: event.target.value }))} placeholder="Section notes" />
                          <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={async () => {
                            await persistPart("section", newSection);
                            setNewSection(emptyPart());
                          }}>
                            <Plus className="h-4 w-4" />
                            Add section
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-[var(--color-brass)]" />
                        <h3 className="text-xl font-black">Layers</h3>
                      </div>
                      <div className="space-y-3">
                        {selectedSong.layers.map((layer) => (
                          <div key={layer.name} className="glass-card-soft rounded-[1.25rem] p-4">
                            <FieldGroup label="Layer name">
                              <input
                                className="field"
                                value={layer.name}
                                onChange={(event) => setSelectedSong((current) => current ? {
                                  ...current,
                                  layers: current.layers.map((item) => item.name === layer.name ? { ...item, name: event.target.value } : item),
                                } : current)}
                              />
                            </FieldGroup>
                            <FieldGroup label="Notes" className="mt-3">
                              <textarea
                                className="field min-h-24"
                                value={layer.text ?? ""}
                                onChange={(event) => setSelectedSong((current) => current ? {
                                  ...current,
                                  layers: current.layers.map((item) => item.name === layer.name ? { ...item, text: event.target.value } : item),
                                } : current)}
                              />
                            </FieldGroup>
                            <div className="mt-3 flex gap-2">
                              <Button radius="full" className="bg-[var(--color-copper)] text-white" onPress={() => void persistPart("layer", layer)}>Save</Button>
                              <Button radius="full" variant="bordered" color="danger" onPress={() => void removePart("layer", layer.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="rounded-[1.25rem] border border-dashed border-white/12 p-4">
                          <div className="mb-3 text-sm font-semibold">Add layer</div>
                          <input className="field mb-3" value={newLayer.name} onChange={(event) => setNewLayer((current) => ({ ...current, name: event.target.value }))} placeholder="drums" />
                          <textarea className="field mb-3 min-h-20" value={newLayer.text} onChange={(event) => setNewLayer((current) => ({ ...current, text: event.target.value }))} placeholder="Layer notes" />
                          <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={async () => {
                            await persistPart("layer", newLayer);
                            setNewLayer(emptyPart());
                          }}>
                            <Plus className="h-4 w-4" />
                            Add layer
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {editorTab === "advanced" ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FieldGroup label="song_json">
                      <textarea
                        className="field min-h-72 font-mono text-xs"
                        value={selectedSong.song.song_json}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { song_json: event.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="production_json">
                      <textarea
                        className="field min-h-72 font-mono text-xs"
                        value={selectedSong.song.production_json ?? "{}"}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { production_json: event.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="melody_json">
                      <textarea
                        className="field min-h-52 font-mono text-xs"
                        value={selectedSong.song.melody_json ?? "{}"}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { melody_json: event.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="metadata_json">
                      <textarea
                        className="field min-h-52 font-mono text-xs"
                        value={selectedSong.song.metadata_json ?? "{}"}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { metadata_json: event.target.value }))}
                      />
                    </FieldGroup>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </>
        ) : (
          <div className="panel rounded-[1.75rem] p-8 text-center">
            <Music2 className="mx-auto h-10 w-10 text-[var(--color-brass)] opacity-60" />
            <p className="mt-4 text-sm text-[var(--color-sand-2)]">No songs in your library yet.</p>
            <Button className="mt-4 bg-[var(--color-copper)] text-white" radius="full" onPress={() => void createDraftSong()}>
              <Plus className="h-4 w-4" />
              Create first song
            </Button>
          </div>
        )}
      </section>

      <Modal isOpen={deleteOpen} onOpenChange={onDeleteOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Delete song</ModalHeader>
              <ModalBody>
                <p className="text-sm text-[var(--color-sand-2)]">
                  Permanently delete <strong className="text-[var(--color-foreground)]">{deleteTarget?.title}</strong>?
                  Sections, layers, and partitures linked to this song will also be removed.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="danger" onPress={() => void removeSong()}>Delete song</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
