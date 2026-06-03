import { AppShell } from "@/components/app-shell";

export default function ProgressionsPage() {
  return (
    <AppShell
      title="Progression Builder"
      eyebrow="Writing"
      description="Experiment with chord structures and discover new harmonies."
      pageKey="progressions"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="panel p-6 rounded-2xl flex flex-col gap-2">
          <div className="eyebrow text-[var(--color-copper)]">Generator</div>
          <h3 className="text-xl font-bold">Roman Numeral Analysis</h3>
          <p className="text-sm text-[var(--color-sand-2)]">Build progressions using functional harmony.</p>
        </div>
        <div className="panel p-6 rounded-2xl flex flex-col gap-2">
          <div className="eyebrow text-[var(--color-mint)]">Library</div>
          <h3 className="text-xl font-bold">Common Progressions</h3>
          <p className="text-sm text-[var(--color-sand-2)]">Explore standard pop, jazz, and classical movements.</p>
        </div>
      </div>
    </AppShell>
  );
}
