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
  const [selectedTemplate, setSelectedTemplate] = useState<MusicTaskTemplateRecord | null>(null);
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure({
    onClose: () => setSelectedTemplate(null),
  });

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
      await loadTemplates();
    } catch (error) {
      toast.error((error as Error).message);
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
        onClose();
      }
      await loadTemplates();
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
      await loadTemplates();
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
    onOpen();
  }

  function startEditing(template: MusicTaskTemplateRecord) {
    setDraft(templateToDraft(template));
    setSelectedTemplate(null);
    onClose();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      {/* 1. Template Library & Directory (Important: Open by default) */}
      <CollapsibleCard
        defaultOpen={true}
        title={libraryTitle}
        subtitle={`Showing ${filteredTemplates.length} of ${templates.length} ${itemLabel.toLowerCase()}s`}
        eyebrow={libraryEyebrow}
        icon={<BookOpen className="h-5 w-5 text-[var(--color-brass)]" />}
        badge={
          <span className="glass-pill px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-brass)]">
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
            <div className="space-y-2 pt-2">
              {filteredTemplates.length === 0 ? (
                <div className="glass-card-soft rounded-[1.25rem] p-4 text-sm text-[var(--color-sand-2)] text-center">
                  {templates.length === 0
                    ? `No saved ${itemLabel.toLowerCase()}s yet. Create one from the editor panel.`
                    : "No prompts match the current filters."}
                </div>
              ) : null}
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group flex w-full items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)]/50 p-3 transition hover:border-[var(--color-info-border)] hover:bg-[var(--color-info-surface)]"
                >
                  <button
                    type="button"
                    onClick={() => openTemplate(template)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-bold text-[var(--color-foreground)]">{template.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-sand-2)]">
                      {template.genre ? <span className="font-semibold text-[var(--color-brass)]">{template.genre}</span> : null}
                      {template.genre && template.category ? <span aria-hidden="true">·</span> : null}
                      {template.category ? <span>{template.category}</span> : null}
                      {!template.genre && !template.category ? <span>{template.targetType}</span> : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    title="Copy prompt instructions"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await navigator.clipboard.writeText(template.instructions);
                        toast.success("Prompt copied");
                      } catch {
                        toast.error("Clipboard unavailable");
                      }
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] opacity-0 transition group-hover:opacity-100 hover:border-[var(--color-info-border)] hover:text-[var(--color-foreground)]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openTemplate(template)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--color-sand-2)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-foreground)]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* 2. Prompt Creator / Editor (Important: Open by default) */}
      <CollapsibleCard
        defaultOpen={true}
        title={draft.id ? editTitle : createTitle}
        subtitle={draft.id ? "Modifying existing prompt blueprint" : "Author a new AI songwriting prompt"}
        eyebrow={editorEyebrow}
        icon={<Sparkles className="h-5 w-5 text-[var(--color-copper)]" />}
      >
        <div className="space-y-3.5">
          <input className="field font-bold" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={namePlaceholder} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="field text-xs" value={draft.genre} onChange={(event) => setDraft((current) => ({ ...current, genre: event.target.value }))} placeholder="Genre (e.g. rock, pop)" />
            <input className="field text-xs" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Category" />
          </div>
          <input className="field text-xs" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description (optional)" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="field text-xs"
              value={draft.targetType}
              onChange={(event) => setDraft((current) => ({ ...current, targetType: event.target.value as MusicTaskTemplateRecord["targetType"] }))}
            >
              <option value="song-field">Song field</option>
              <option value="part">Song part (section/layer)</option>
            </select>
            <input
              className="field text-xs"
              value={draft.targetField}
              onChange={(event) => setDraft((current) => ({ ...current, targetField: event.target.value }))}
              placeholder={draft.targetType === "part" ? "Part name (e.g. verse_1)" : "Field (e.g. lyrics_text)"}
            />
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
          <textarea
            className="field min-h-20 font-mono text-xs text-[var(--color-sand-2)]"
            value={draft.targetType === "part" && draft.targetKinds.length > 0
              ? `Applies to ${draft.targetKinds.join(" + ")} named ${draft.targetField || "(all)"}`
              : draft.targetField
                ? `Applies to field: ${draft.targetField}`
                : "Targets the primary song record"}
            readOnly
          />
          <textarea className="field min-h-48 font-mono text-xs" value={draft.instructions} onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))} placeholder={instructionsPlaceholder} />
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
            <span>Token count</span>
            <span>{draft.instructions.length.toLocaleString()} chars · ~{Math.max(1, Math.ceil(draft.instructions.trim().split(/\s+/).filter(Boolean).length * 1.33)).toLocaleString()} est. tokens</span>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={persistTemplate}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-4 py-2 text-xs font-bold text-black shadow-sm transition hover:brightness-110 active:scale-95"
            >
              {draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{draft.id ? `Update ${itemLabel}` : `Create ${itemLabel}`}</span>
            </button>
            {draft.id ? (
              <button
                type="button"
                onClick={() => setDraft(emptyDraft)}
                className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </CollapsibleCard>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        scrollBehavior="inside"
        size="2xl"
        {...opaqueModalProps}
      >
        <ModalContent>
          {(close) => selectedTemplate ? (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brass)]">{itemLabel}</span>
                <span className="text-2xl font-black">{selectedTemplate.name}</span>
              </ModalHeader>
              <ModalBody className="gap-5">
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.genre ? <Chip size="sm" variant="flat">{selectedTemplate.genre}</Chip> : null}
                  {selectedTemplate.category ? <Chip size="sm" variant="flat">{selectedTemplate.category}</Chip> : null}
                  <Chip size="sm" variant="flat">{selectedTemplate.targetType}</Chip>
                  {selectedTemplate.targetField ? <Chip size="sm" variant="flat">{selectedTemplate.targetField}</Chip> : null}
                  {selectedTemplate.targetKinds.length > 0 ? (
                    <Chip size="sm" variant="flat">{selectedTemplate.targetKinds.join(", ")}</Chip>
                  ) : null}
                </div>

                {selectedTemplate.description ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brass)]">Description</div>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-foreground)] opacity-90">{selectedTemplate.description}</p>
                  </div>
                ) : null}

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brass)]">{instructionsPlaceholder}</div>
                  <pre className="modal-inset-panel mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-[1rem] p-4 font-mono text-xs leading-6">
                    {selectedTemplate.instructions}
                  </pre>
                </div>

                <div className="grid gap-3 text-sm text-[var(--color-foreground)] opacity-90 sm:grid-cols-2">
                  <div>
                    <span className="font-semibold uppercase tracking-[0.14em] text-[var(--color-brass)]">Created</span>
                    <p className="mt-1">{formatTimestamp(selectedTemplate.createdAt)}</p>
                  </div>
                  <div>
                    <span className="font-semibold uppercase tracking-[0.14em] text-[var(--color-brass)]">Updated</span>
                    <p className="mt-1">{formatTimestamp(selectedTemplate.updatedAt)}</p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button radius="full" variant="bordered" onPress={close}>
                  Close
                </Button>
                <Button
                  radius="full"
                  variant="bordered"
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
                  className="bg-[var(--color-copper)] text-white"
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