import { AppShell } from "@/components/app-shell";

export default function MusicianHelpersPage() {
  return (
    <AppShell
      title="Musician Helpers"
      eyebrow="Tools"
      description="Quick utilities and references for instrumentalists."
      pageKey="musician-helpers"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder cards for future specific tools */}
        <div className="panel p-6 rounded-2xl flex flex-col gap-2">
          <div className="eyebrow text-[var(--color-brass)]">Guitar</div>
          <h3 className="text-xl font-bold">Fretboard Visualizer</h3>
          <p className="text-sm text-[var(--color-sand-2)]">Explore scales, modes, and arpeggios across the neck.</p>
        </div>
        <div className="panel p-6 rounded-2xl flex flex-col gap-2">
          <div className="eyebrow text-[var(--color-copper)]">Tempo</div>
          <h3 className="text-xl font-bold">Metronome</h3>
          <p className="text-sm text-[var(--color-sand-2)]">Advanced click tracks with complex subdivisions.</p>
        </div>
        <div className="panel p-6 rounded-2xl flex flex-col gap-2">
          <div className="eyebrow text-[var(--color-mint)]">Drummers</div>
          <h3 className="text-xl font-bold">Groove Library</h3>
          <p className="text-sm text-[var(--color-sand-2)]">Common patterns and rhythmic exercises.</p>
        </div>
      </div>
    </AppShell>
  );
}
