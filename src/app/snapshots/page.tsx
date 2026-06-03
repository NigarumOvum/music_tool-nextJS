import { AppShell } from "@/components/app-shell";
import { SnapshotsClient } from "@/components/music/snapshots-client";

export default function SnapshotsPage() {
  return (
    <AppShell
      title="Snapshots"
      eyebrow="Rollback Safety"
      description="Manual checkpoints and one-click restore for the current song inventory, so edits and AI passes remain reversible."
    >
      <SnapshotsClient />
    </AppShell>
  );
}