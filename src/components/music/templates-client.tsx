"use client";

import { useEffect, useState } from "react";

import { Button, Chip, Spinner } from "@heroui/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createTemplate, deleteTemplate, fetchTemplates, updateTemplate } from "@/lib/music/client";
import type { MusicTaskTemplateRecord } from "@/lib/music/types";

type TemplateDraft = {
  id?: string;
  name: string;
  category: string;
  description: string;
  targetType: "song-field" | "part";
  targetField: string;
  targetKinds: string[];
  instructions: string;
};

const emptyDraft: TemplateDraft = {
  name: "",
  category: "",
  description: "",
  targetType: "song-field",
  targetField: "lyrics_text",
  targetKinds: ["section"],
  instructions: "",
};

export function TemplatesClient() {
  const [templates, setTemplates] = useState<MusicTaskTemplateRecord[]>([]);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);

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
      if (draft.id) {
        await updateTemplate(draft.id, draft);
        toast.success("Template updated");
      } else {
        await createTemplate(draft);
        toast.success("Template created");
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
      toast.success("Template deleted");
      if (draft.id === id) {
        setDraft(emptyDraft);
      }
      await loadTemplates();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="panel rounded-[1.75rem] p-5">
        <div className="eyebrow">Template library</div>
        <h2 className="mt-2 text-3xl font-black">Reusable enhancement workflows</h2>
        {loading ? (
          <div className="mt-6 flex justify-center"><Spinner color="warning" /></div>
        ) : (
          <div className="mt-6 space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black">{template.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {template.category ? <Chip size="sm" variant="flat">{template.category}</Chip> : null}
                      <Chip size="sm" variant="flat">{template.targetType}</Chip>
                      {template.targetField ? <Chip size="sm" variant="flat">{template.targetField}</Chip> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button radius="full" variant="bordered" onPress={() => setDraft({
                      id: template.id,
                      name: template.name,
                      category: template.category || "",
                      description: template.description || "",
                      targetType: template.targetType,
                      targetField: template.targetField || "lyrics_text",
                      targetKinds: template.targetKinds,
                      instructions: template.instructions,
                    })}>Edit</Button>
                    <Button radius="full" variant="bordered" color="danger" onPress={() => void removeTemplate(template.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--color-sand-2)]">{template.description || template.instructions}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel rounded-[1.75rem] p-5">
        <div className="eyebrow">Editor</div>
        <h3 className="mt-2 text-2xl font-black">{draft.id ? "Edit template" : "Create template"}</h3>
        <div className="mt-4 space-y-3">
          <input className="field" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Template name" />
          <input className="field" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Category" />
          <input className="field" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
          <select className="field" value={draft.targetType} onChange={(event) => setDraft((current) => ({ ...current, targetType: event.target.value as "song-field" | "part" }))}>
            <option value="song-field">song-field</option>
            <option value="part">part</option>
          </select>
          {draft.targetType === "song-field" ? (
            <input className="field" value={draft.targetField} onChange={(event) => setDraft((current) => ({ ...current, targetField: event.target.value }))} placeholder="lyrics_text" />
          ) : (
            <input className="field" value={draft.targetKinds.join(", ")} onChange={(event) => setDraft((current) => ({ ...current, targetKinds: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} placeholder="section, layer" />
          )}
          <textarea className="field min-h-56" value={draft.instructions} onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))} placeholder="Instructions" />
          <div className="flex gap-2">
            <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={persistTemplate}>
              {draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {draft.id ? "Update" : "Create"}
            </Button>
            {draft.id ? <Button radius="full" variant="bordered" onPress={() => setDraft(emptyDraft)}>Reset</Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}