"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, useDisclosure } from "@heroui/react";
import { ChevronRight, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { createTemplate, deleteTemplate, fetchTemplates, updateTemplate } from "@/lib/music/client";
import type { MusicTaskTemplateRecord, MusicTemplateTargetType } from "@/lib/music/types";
import { PromptRunnerPanel } from "@/components/music/prompt-runner-panel";
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
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="panel rounded-[1.75rem] p-5">
        <div className="eyebrow">{libraryEyebrow}</div>
        <h2 className="mt-2 text-3xl font-black">{libraryTitle}</h2>
        <div className="mt-4 space-y-3">
          <input
            className="field"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search name, genre, category, instructions..."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select
              className="field"
              value={filters.genre}
              onChange={(event) => setFilters((current) => ({ ...current, genre: event.target.value }))}
            >
              <option value="">All genres</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
            <select
              className="field"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              className="field"
              value={filters.targetType}
              onChange={(event) => setFilters((current) => ({ ...current, targetType: event.target.value as TemplateFilters["targetType"] }))}
            >
              <option value="">All target types</option>
              <option value="song-field">Song field</option>
              <option value="part">Song part</option>
            </select>
            <select
              className="field"
              value={filters.targetField}
              onChange={(event) => setFilters((current) => ({ ...current, targetField: event.target.value }))}
            >
              <option value="">All target fields</option>
              {targetFields.map((targetField) => (
                <option key={targetField} value={targetField}>{targetField}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-sand-2)]">
            <span>
              Showing {filteredTemplates.length} of {templates.length} {itemLabel.toLowerCase()}s
            </span>
            <div className="flex items-center gap-2">
              <select
                className="field w-auto py-1.5 text-xs font-bold"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                aria-label="Sort templates"
              >
                <option value="name">Name A–Z</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => setFilters(emptyFilters)}
                  className="glass-pill inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition hover:-translate-y-0.5"
                >
                  <X className="h-3 w-3" />
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {loading ? (
          <div className="mt-6 flex justify-center"><Spinner color="warning" /></div>
        ) : (
          <div className="mt-4 space-y-1.5">
            {filteredTemplates.length === 0 ? (
              <div className="glass-card-soft rounded-[1.25rem] p-4 text-sm text-[var(--color-sand-2)]">
                {templates.length === 0
                  ? `No saved ${itemLabel.toLowerCase()}s yet. Create one from the editor panel.`
                  : "No prompts match the current filters."}
              </div>
            ) : null}
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => openTemplate(template)}
                className="group flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-left transition hover:border-[var(--color-info-border)] hover:bg-[var(--color-info-surface)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--color-foreground)]">{template.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-sand-2)]">
                    {template.genre ? <span className="truncate">{template.genre}</span> : null}
                    {template.genre && template.category ? <span aria-hidden="true">·</span> : null}
                    {template.category ? <span className="truncate">{template.category}</span> : null}
                    {!template.genre && !template.category ? <span className="truncate">{template.targetType}</span> : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-sand-2)] transition group-hover:text-[var(--color-foreground)]" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel rounded-[1.75rem] p-5">
        <div className="eyebrow">{editorEyebrow}</div>
        <h3 className="mt-2 text-2xl font-black">{draft.id ? editTitle : createTitle}</h3>
        <div className="mt-4 space-y-3">
          <input className="field" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={namePlaceholder} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="field" value={draft.genre} onChange={(event) => setDraft((current) => ({ ...current, genre: event.target.value }))} placeholder="Genre (e.g. rock, cumbia, pop)" />
            <input className="field" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Category" />
          </div>
          <input className="field" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="field"
              value={draft.targetType}
              onChange={(event) => setDraft((current) => ({ ...current, targetType: event.target.value as MusicTaskTemplateRecord["targetType"] }))}
            >
              <option value="song-field">Song field</option>
              <option value="part">Song part (section/layer)</option>
            </select>
            <input
              className="field"
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
                      ? current.targetKinds.filter((item) => item !== kind)
                      : [...current.targetKinds, kind],
                  }))}
                  className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                    draft.targetKinds.includes(kind)
                      ? "bg-[var(--color-copper)] text-white"
                      : "opacity-50 hover:opacity-100"
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            className="field min-h-32 font-mono text-xs"
            value={draft.targetType === "part" && draft.targetKinds.length > 0
              ? `Applies to ${draft.targetKinds.join(" + ")} named ${draft.targetField || "(all)"}`
              : draft.targetField
                ? `Applies to field: ${draft.targetField}`
                : "Targets the primary song record"}
            readOnly
          />
          <textarea className="field min-h-56" value={draft.instructions} onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))} placeholder={instructionsPlaceholder} />
          <div className="text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
            {draft.instructions.length.toLocaleString()} chars · ~{Math.max(1, Math.ceil(draft.instructions.trim().split(/\s+/).filter(Boolean).length * 1.33)).toLocaleString()} est. tokens
          </div>
          <div className="flex gap-2">
            <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={persistTemplate}>
              {draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {draft.id ? `Update ${itemLabel}` : `Create ${itemLabel}`}
            </Button>
            {draft.id ? <Button radius="full" variant="bordered" onPress={() => setDraft(emptyDraft)}>Reset</Button> : null}
          </div>
        </div>
      </div>

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

                <div className="modal-inset-panel rounded-[1rem] p-4">
                  <PromptRunnerPanel
                    templateId={selectedTemplate.id}
                    templateName={selectedTemplate.name}
                    targetLabel={selectedTemplate.targetField || selectedTemplate.targetType}
                  />
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