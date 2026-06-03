import { AppShell } from "@/components/app-shell";

export default function TheoryLabPage() {
  return (
    <AppShell
      title="Theory Lab"
      eyebrow="Education"
      description="Interactive tools for music theory, scales, and chords."
      pageKey="theory-lab"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="panel p-6 rounded-2xl flex flex-col gap-2">
          <div className="eyebrow text-[var(--color-berry)]">Harmony</div>
          <h3 className="text-xl font-bold">Circle of Fifths</h3>
          <p className="text-sm text-[var(--color-sand-2)]">Navigate key signatures and relative relationships.</p>
        </div>
        <div className="panel p-6 rounded-2xl flex flex-col gap-2">
          <div className="eyebrow text-[var(--color-brass)]">Scales</div>
          <h3 className="text-xl font-bold">Modes</h3>
          <p className="text-sm text-[var(--color-sand-2)]">Learn modal construction and their characteristic sounds.</p>
        </div>
      </div>
    </AppShell>
  );
}
