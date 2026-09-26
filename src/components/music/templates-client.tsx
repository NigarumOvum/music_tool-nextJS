"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, useDisclosure } from "@heroui/react";
import { ChevronRight, Copy, Pencil, Plus, Save, Trash2, X, Sparkles, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { CollapsibleCard } from "@/components/collapsible-card";
import { createTemplate, deleteTemplate, fetchTemplates, updateTemplate } from "@/lib/music/client";
import type { MusicTaskTemplateRecord, MusicTemplateTargetType } from "@/lib/music/types";
import { opaqueModalProps } from "@/lib/ui/modal-styles";

type TemplateDraft = {
  id?: string;
  name: string;
  category: string;
  genre: string;
  description: string;
  instructions: string;
  targetType: MusicTaskTemplateRecord["targetType"];
  targetField: string;
  targetKinds: MusicTaskTemplateRecord["targetKinds"];
};

type TemplateFilters = {
  search: string;
  genre: string;
  category: string;
  targetType: "" | MusicTemplateTargetType;
  targetField: string;
};

type SortOrder = "name" | "newest" | "oldest";

type TemplatesClientProps = {
  libraryEyebrow?: string;
  libraryTitle?: string;
  editorEyebrow?: string;
  createTitle?: string;
  editTitle?: string;
  itemLabel?: string;
  namePlaceholder?: string;
  instructionsPlaceholder?: string;
};

const emptyDraft: TemplateDraft = {
  name: "",
  category: "",
  genre: "",
  description: "",
  instructions: "",
  targetType: "song-field",
  targetField: "",
  targetKinds: [],
};

const emptyFilters: TemplateFilters = {
  search: "",
  genre: "",
  category: "",
  targetType: "",
  targetField: "",
};

function templateToDraft(template: MusicTaskTemplateRecord): TemplateDraft {
  return {
    id: template.id,
    name: template.name,
    category: template.category || "",
    genre: template.genre || "",
    description: template.description || "",
    targetType: template.targetType,
    targetField: template.targetField || "",
    targetKinds: template.targetKinds,
    instructions: template.instructions,
  };
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TemplatesClient({
  libraryEyebrow = "Template library",
  libraryTitle = "Reusable enhancement workflows",
  editorEyebrow = "Editor",
  createTitle = "Create template",
  editTitle = "Edit template",
  itemLabel = "Template",
  namePlaceholder = "Template name",
  instructionsPlaceholder = "Instructions",
}: TemplatesClientProps) {
  const [templates, setTemplates] = useState<MusicTaskTemplateRecord[]>([]);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [filters, setFilters] = useState<TemplateFilters>(emptyFilters);
  const [sortOrder, setSortOrder] = useState<SortOrder>("name");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MusicTaskTemplateRecord | null>(null);
  const {
    isOpen: isDetailOpen,
    onOpen: onDetailOpen,
    onOpenChange: onDetailOpenChange,
    onClose: onDetailClose,
  } = useDisclosure({
    onClose: () => setSelectedTemplate(null),
  });
  const {
    isOpen: isEditorOpen,
    onOpen: onEditorOpen,
    onOpenChange: onEditorOpenChange,
    onClose: onEditorClose,
  } = useDisclosure();

  const genres = useMemo(
    () => Array.from(new Set(templates.map((template) => template.genre).filter((value): value is string => Boolean(value)))).sort(),
    [templates],
  );

  const categories = useMemo(
    () => Array.from(new Set(templates.map((template) => template.category).filter((value): value is string => Boolean(value)))).sort(),
    [templates],
  );

  const targetFields = useMemo(
    () => Array.from(new Set(
      templates
        .map((template) => template.targetField)
        .filter((value): value is NonNullable<MusicTaskTemplateRecord["targetField"]> => Boolean(value)),
    )).sort(),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const genreQuery = filters.genre.trim().toLowerCase();
    const categoryQuery = filters.category.trim().toLowerCase();
    const targetFieldQuery = filters.targetField.trim().toLowerCase();

    const matched = templates.filter((template) => {
      if (query) {
        const haystack = [
          template.name,
          template.category,
          template.genre,
          template.description,
          template.instructions,
          template.targetField,
          template.targetKinds.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (genreQuery && (template.genre || "").toLowerCase() !== genreQuery) {
        return false;
      }

      if (categoryQuery && (template.category || "").toLowerCase() !== categoryQuery) {
        return false;
      }

      if (filters.targetType && template.targetType !== filters.targetType) {
        return false;
      }

      if (targetFieldQuery && (template.targetField || "").toLowerCase() !== targetFieldQuery) {
        return false;
      }

      return true;
    });

    return [...matched].sort((a, b) => {
      if (sortOrder === "name") return a.name.localeCompare(b.name);
      if (sortOrder === "newest") return b.updatedAt.localeCompare(a.updatedAt);
      return a.updatedAt.localeCompare(b.updatedAt);
    });
  }, [filters, sortOrder, templates]);

  const hasActiveFilters = Boolean(
    filters.search || filters.genre || filters.category || filters.targetType || filters.targetField,
  );

  async function loadTemplates(showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const payload = await fetchTemplates();
      setTemplates(payload.templates);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const payload = await fetchTemplates();
        if (!cancelled) {
          setTemplates(payload.templates);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  async function persistTemplate() {
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        category: draft.category || null,
        genre: draft.genre || null,
        description: draft.description || null,
        targetType: draft.targetType,
        targetField: draft.targetField || (draft.targetType === "song-field" ? "lyrics_text" : null),
        targetKinds: draft.targetKinds,
        instructions: draft.instructions,
      };
      if (draft.id) {
        await updateTemplate(draft.id, payload);
        toast.success(`${itemLabel} updated`);
      } else {
        await createTemplate(payload);
        toast.success(`${itemLabel} created`);
      }
      setDraft(emptyDraft);
      onEditorClose();
      await loadTemplates(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeTemplate(id: string) {
    try {
      await deleteTemplate(id);
      toast.success(`${itemLabel} deleted`);
      if (draft.id === id) {
        setDraft(emptyDraft);
      }
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        onDetailClose();
      }
      await loadTemplates(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function duplicateTemplate(template: MusicTaskTemplateRecord) {
    try {
      await createTemplate({
        name: `${template.name} (copy)`,
        category: template.category || null,
        genre: template.genre || null,
        description: template.description || null,
        targetType: template.targetType,
        targetField: template.targetField || (template.targetType === "song-field" ? "lyrics_text" : null),
        targetKinds: template.targetKinds,
        instructions: template.instructions,
      });
      toast.success(`${itemLabel} duplicated`);
      await loadTemplates(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function copyInstructions() {
    if (!selectedTemplate) return;
    try {
      await navigator.clipboard.writeText(selectedTemplate.instructions);
      toast.success("Instructions copied to clipboard");
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  function openTemplate(template: MusicTaskTemplateRecord) {
    setSelectedTemplate(template);
    onDetailOpen();
  }

  function openCreateModal() {
    setDraft(emptyDraft);
    onEditorOpen();
  }

  function startEditing(template: MusicTaskTemplateRecord) {
    setDraft(templateToDraft(template));
    setSelectedTemplate(null);
    onDetailClose();
    onEditorOpen();
  }

  const editorTokenEstimate = Math.max(
    1,
    Math.ceil(draft.instructions.trim().split(/\s+/).filter(Boolean).length * 1.33),
  );

  return (
    <div className="space-y-4">
      {/* Top-right Create Prompt action — library below takes full width */}
      <div className="flex items-center justify-between gap-3 px-1 sm:px-2">
        <p className="text-xs text-[var(--color-sand-2)]">
          {loading ? "Loading prompts…" : `${filteredTemplates.length} of ${templates.length} shown`}
        </p>
        <Button
          onPress={openCreateModal}
          startContent={<Plus className="h-4 w-4" />}
          className="bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] font-bold text-black shadow-[0_8px_26px_color-mix(in_srgb,var(--color-brass)_40%,transparent)] transition hover:brightness-110 active:scale-95"
          radius="full"
        >
          Create Prompt
        </Button>
      </div>

      {/* Full-width Prompt Library */}
      <CollapsibleCard
        defaultOpen={true}
        title={libraryTitle}
        subtitle={`Showing ${filteredTemplates.length} of ${templates.length} ${itemLabel.toLowerCase()}s`}
        eyebrow={libraryEyebrow}
        icon={<BookOpen className="h-5 w-5 text-[var(--color-brass)]" />}
        badge={
          <span className="glass-pill bg-gradient-to-r from-[var(--color-warning-surface)] to-[var(--color-info-surface)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-brass)]">
            {templates.length} Prompts
          </span>
        }
        headerActions={
          hasActiveFilters ? (
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="glass-pill inline-flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-widest transition hover:-translate-y-0.5"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <input
            className="field"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search name, genre, category, instructions..."
          />
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <select
              className="field text-xs"
              value={filters.genre}
              onChange={(event) => setFilters((current) => ({ ...current, genre: event.target.value }))}
            >
              <option value="">All genres</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
            <select
              className="field text-xs"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              className="field text-xs"
              value={filters.targetType}
              onChange={(event) => setFilters((current) => ({ ...current, targetType: event.target.value as TemplateFilters["targetType"] }))}
            >
              <option value="">All target types</option>
              <option value="song-field">Song field</option>
              <option value="part">Song part</option>
            </select>
            <select
              className="field text-xs"
              value={filters.targetField}
              onChange={(event) => setFilters((current) => ({ ...current, targetField: event.target.value }))}
            >
              <option value="">All target fields</option>
              {targetFields.map((targetField) => (
                <option key={targetField} value={targetField}>{targetField}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-sand-2)] pt-1">
            <span>Sorted by:</span>
            <select
              className="field w-auto py-1 text-xs font-bold"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              aria-label="Sort templates"
            >
              <option value="name">Name A–Z</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><Spinner color="warning" /></div>
          ) : (
            <div className="grid gap-2.5 pt-2 md:grid-cols-2 2xl:grid-cols-3">
              {filteredTemplates.length === 0 ? (
                <div className="glass-card-soft rounded-[1.25rem] border-[var(--color-warning-border)] bg-gradient-to-br from-[var(--color-warning-surface)] to-transparent p-6 text-center md:col-span-2 2xl:col-span-3">
                  <p className="text-sm text-[var(--color-sand-2)]">
                    {templates.length === 0
                      ? `No saved ${itemLabel.toLowerCase()}s yet. Create your first prompt to get started.`
                      : "No prompts match the current filters."}
                  </p>
                  {templates.length === 0 ? (
                    <Button
                      onPress={openCreateModal}
                      startContent={<Plus className="h-4 w-4" />}
                      radius="full"
                      className="mt-4 bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] font-bold text-black"
                    >
                      Create Prompt
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group relative flex w-full items-center gap-2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-strong)] to-[var(--color-surface-soft)] py-3 pl-4 pr-2.5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[var(--color-info-border)] hover:bg-[var(--color-info-surface)] hover:shadow-[0_12px_32px_-8px_color-mix(in_srgb,var(--color-copper)_30%,transparent)]"
                >
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2.5 left-1.5 top-2.5 w-1 rounded-full bg-gradient-to-b from-[var(--color-brass)] via-[var(--color-gold)] to-[var(--color-copper)] opacity-60 transition group-hover:opacity-100"
                  />
                  <button
                    type="button"
                    onClick={() => openTemplate(template)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-copper)]">
                      {template.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      {template.genre ? (
                        <span className="rounded-full border border-[var(--color-info-border)] bg-[var(--color-info-surface)] px-2 py-0.5 font-bold text-[var(--color-copper)]">
                          {template.genre}
                        </span>
                      ) : null}
                      {template.category ? (
                        <span className="rounded-full border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-2 py-0.5 font-semibold text-[var(--color-brass)]">
                          {template.category}
                        </span>
                      ) : null}
                      {!template.genre && !template.category ? (
                        <span className="font-semibold text-[var(--color-sand-2)]">{template.targetType}</span>
                      ) : (
                        <span className="font-medium text-[var(--color-sand-2)]">
                          · {template.targetField || template.targetType}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    title="Copy prompt instructions"
                    aria-label={`Copy ${template.name} instructions`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await navigator.clipboard.writeText(template.instructions);
                        toast.success("Prompt copied");
                      } catch {
                        toast.error("Clipboard unavailable");
                      }
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] opacity-0 transition group-hover:opacity-100 hover:border-[var(--color-info-border)] hover:text-[var(--color-copper)] focus-visible:opacity-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openTemplate(template)}
                    aria-label={`Open ${template.name} details`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--color-sand-2)] transition group-hover:translate-x-0.5 group-hover:bg-[var(--color-info-surface)] group-hover:text-[var(--color-copper)]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* Create / Edit Prompt modal (replaces the old right-side editor panel) */}
      <Modal
        isOpen={isEditorOpen}
        onOpenChange={onEditorOpenChange}
        scrollBehavior="inside"
        size="2xl"
        {...opaqueModalProps}
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-brass)] to-[var(--color-gold)] text-black shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brass)]">{editorEyebrow}</span>
                    <span className="text-xl font-black text-[var(--color-foreground)]">{draft.id ? editTitle : createTitle}</span>
                  </span>
                </div>
                <span className="text-xs font-medium text-[var(--color-sand-2)]">
                  {draft.id ? "Modifying existing prompt blueprint" : "Author a new AI songwriting prompt"}
                </span>
              </ModalHeader>
              <ModalBody className="gap-4">
                <div className="field-group">
                  <label className="field-label" htmlFor="prompt-name">Name</label>
                  <input
                    id="prompt-name"
                    className="field font-bold"
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder={namePlaceholder}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="prompt-genre">Genre</label>
                    <input
                      id="prompt-genre"
                      className="field text-xs"
                      value={draft.genre}
                      onChange={(event) => setDraft((current) => ({ ...current, genre: event.target.value }))}
                      placeholder="Genre (e.g. rock, pop)"
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="prompt-category">Category</label>
                    <input
                      id="prompt-category"
                      className="field text-xs"
                      value={draft.category}
                      onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                      placeholder="Category"
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="prompt-description">Description</label>
                  <input
                    id="prompt-description"
                    className="field text-xs"
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Description (optional)"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="prompt-target-type">Target type</label>
                    <select
                      id="prompt-target-type"
                      className="field text-xs"
                      value={draft.targetType}
                      onChange={(event) => setDraft((current) => ({ ...current, targetType: event.target.value as MusicTaskTemplateRecord["targetType"] }))}
                    >
                      <option value="song-field">Song field</option>
                      <option value="part">Song part (section/layer)</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="prompt-target-field">Target</label>
                    <input
                      id="prompt-target-field"
                      className="field text-xs"
                      value={draft.targetField}
                      onChange={(event) => setDraft((current) => ({ ...current, targetField: event.target.value }))}
                      placeholder={draft.targetType === "part" ? "Part name (e.g. verse_1)" : "Field (e.g. lyrics_text)"}
                    />
                  </div>
                </div>
                {draft.targetType === "part" ? (
                  <div className="flex flex-wrap gap-2">
                    {(["section", "layer"] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setDraft((current) => ({
                          ...current,
                          targetKinds: current.targetKinds.includes(kind)
                            ? current.targetKinds.filter((k) => k !== kind)
                            : [...current.targetKinds, kind],
                        }))}
                        className={`tab-editor-pill ${draft.targetKinds.includes(kind) ? "tab-editor-pill-active" : ""}`}
                      >
                        {kind}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-surface)] px-3 py-2 font-mono text-xs text-[var(--color-copper)]">
                  {draft.targetType === "part" && draft.targetKinds.length > 0
                    ? `Applies to ${draft.targetKinds.join(" + ")} named ${draft.targetField || "(all)"}`
                    : draft.targetField
                      ? `Applies to field: ${draft.targetField}`
                      : "Targets the primary song record"}
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="prompt-instructions">{instructionsPlaceholder}</label>
                  <textarea
                    id="prompt-instructions"
                    className="field min-h-48 font-mono text-xs"
                    value={draft.instructions}
                    onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))}
                    placeholder={instructionsPlaceholder}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
                  <span>Token count</span>
                  <span>{draft.instructions.length.toLocaleString()} chars · ~{editorTokenEstimate.toLocaleString()} est. tokens</span>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button radius="full" variant="bordered" onPress={close} isDisabled={saving}>
                  Cancel
                </Button>
                {draft.id ? (
                  <Button
                    radius="full"
                    variant="bordered"
                    onPress={() => setDraft(emptyDraft)}
                    isDisabled={saving}
                  >
                    Reset
                  </Button>
                ) : null}
                <Button
                  radius="full"
                  className="bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] font-bold text-black"
                  startContent={draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  onPress={() => void persistTemplate()}
                  isLoading={saving}
                >
                  {draft.id ? `Update ${itemLabel}` : `Create ${itemLabel}`}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Prompt details modal — enriched color treatment */}
      <Modal
        isOpen={isDetailOpen}
        onOpenChange={onDetailOpenChange}
        scrollBehavior="inside"
        size="2xl"
        {...opaqueModalProps}
      >
        <ModalContent>
          {(close) => selectedTemplate ? (
            <>
              <ModalHeader className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-copper)] via-[var(--color-brass)] to-[var(--color-gold)] text-white shadow-[0_8px_26px_color-mix(in_srgb,var(--color-brass)_40%,transparent)]">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brass)]">{itemLabel} details</span>
                    <span className="truncate text-2xl font-black text-[var(--color-foreground)]">{selectedTemplate.name}</span>
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-gradient-to-r from-[var(--color-brass)] via-[var(--color-gold)] to-[var(--color-copper)] opacity-70" aria-hidden="true" />
              </ModalHeader>
              <ModalBody className="gap-5">
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.genre ? <Chip size="sm" variant="flat" color="warning">{selectedTemplate.genre}</Chip> : null}
                  {selectedTemplate.category ? <Chip size="sm" variant="flat" color="secondary">{selectedTemplate.category}</Chip> : null}
                  <Chip size="sm" variant="flat" color="primary">{selectedTemplate.targetType}</Chip>
                  {selectedTemplate.targetField ? <Chip size="sm" variant="flat" color="success">{selectedTemplate.targetField}</Chip> : null}
                  {selectedTemplate.targetKinds.length > 0 ? (
                    <Chip size="sm" variant="flat" color="default">{selectedTemplate.targetKinds.join(", ")}</Chip>
                  ) : null}
                </div>

                {selectedTemplate.description ? (
                  <div className="rounded-[1rem] border-l-4 border-[var(--color-brass)] bg-gradient-to-r from-[var(--color-warning-surface)] to-transparent p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brass)]">Description</div>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-foreground)] opacity-90">{selectedTemplate.description}</p>
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-copper)]">{instructionsPlaceholder}</div>
                    <button
                      type="button"
                      onClick={() => void copyInstructions()}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-info-border)] bg-[var(--color-info-surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-copper)] transition hover:brightness-110"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  </div>
                  <pre className="modal-inset-panel mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-[1rem] border-[var(--color-info-border)] p-4 font-mono text-xs leading-6">
                    {selectedTemplate.instructions}
                  </pre>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-[1rem] border border-[var(--color-info-border)] bg-gradient-to-br from-[var(--color-info-surface)] to-transparent p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-copper)]">Created</span>
                    <p className="mt-1 font-medium text-[var(--color-foreground)]">{formatTimestamp(selectedTemplate.createdAt)}</p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--color-warning-border)] bg-gradient-to-br from-[var(--color-warning-surface)] to-transparent p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brass)]">Updated</span>
                    <p className="mt-1 font-medium text-[var(--color-foreground)]">{formatTimestamp(selectedTemplate.updatedAt)}</p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="flex-wrap">
                <Button radius="full" variant="bordered" onPress={close}>
                  Close
                </Button>
                <Button
                  radius="full"
                  variant="bordered"
                  startContent={<Copy className="h-4 w-4" />}
                  onPress={() => void copyInstructions()}
                >
                  Copy instructions
                </Button>
                <Button
                  radius="full"
                  variant="bordered"
                  onPress={() => void duplicateTemplate(selectedTemplate)}
                >
                  Duplicate
                </Button>
                <Button
                  radius="full"
                  variant="bordered"
                  color="danger"
                  startContent={<Trash2 className="h-4 w-4" />}
                  onPress={() => void removeTemplate(selectedTemplate.id)}
                >
                  Delete
                </Button>
                <Button
                  className="bg-gradient-to-r from-[var(--color-copper)] to-[var(--color-brass)] font-bold text-white"
                  radius="full"
                  startContent={<Pencil className="h-4 w-4" />}
                  onPress={() => startEditing(selectedTemplate)}
                >
                  Edit
                </Button>
              </ModalFooter>
            </>
          ) : null}
        </ModalContent>
      </Modal>
    </div>
  );
}
