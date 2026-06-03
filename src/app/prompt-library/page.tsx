import { AppShell } from "@/components/app-shell";
import { TemplatesClient } from "@/components/music/templates-client";

export default function PromptLibraryPage() {
  return (
    <AppShell
      title="Prompt Library"
      eyebrow="Creative Recipes"
      description="Create and edit reusable prompts for songwriting passes, arrangement direction, bilingual adaptation, and production cleanup."
      pageKey="prompt-library"
    >
      <TemplatesClient
        libraryEyebrow="Prompt library"
        libraryTitle="Editable prompt workflows"
        editorEyebrow="Prompt editor"
        createTitle="Create prompt"
        editTitle="Edit prompt"
        itemLabel="Prompt"
        namePlaceholder="Prompt name"
        instructionsPlaceholder="Prompt text"
      />
    </AppShell>
  );
}