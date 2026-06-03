import { AppShell } from "@/components/app-shell";
import { ProgressionClient } from "@/components/music/progression-client";

export default function ProgressionsPage() {
  return (
    <AppShell
      title="Progression Builder"
      eyebrow="Writing"
      description="Experiment with chord structures and discover new harmonies."
      pageKey="progressions"
    >
      <ProgressionClient />
    </AppShell>
  );
}
