import { AppShell } from "@/components/app-shell";
import { TheoryLabClient } from "@/components/music/theory-lab-client";

export default function TheoryLabPage() {
  return (
    <AppShell
      title="Theory Lab"
      eyebrow="Education"
      description="Interactive tools for music theory, scales, and chords."
      pageKey="theory-lab"
    >
      <TheoryLabClient />
    </AppShell>
  );
}
