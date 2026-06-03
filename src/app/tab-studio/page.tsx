import { AppShell } from "@/components/app-shell";
import { TabStudioClient } from "@/components/music/tab-studio-client";

export default function TabStudioPage() {
  return (
    <AppShell
      title="Guitar Pro Like App"
      eyebrow="Notation Workflow"
      description="Import multi-format tab files, inspect extracted markers, edit a fret grid, and export text or score metadata from the browser."
      pageKey="tab-studio"
    >
      <TabStudioClient />
    </AppShell>
  );
}