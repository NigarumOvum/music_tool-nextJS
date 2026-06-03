import { AppShell } from "@/components/app-shell";
import { HelpersClient } from "@/components/music/helpers-client";

export default function MusicianHelpersPage() {
  return (
    <AppShell
      title="Musician Helpers"
      eyebrow="Tools"
      description="Quick utilities and references for instrumentalists."
      pageKey="musician-helpers"
    >
      <HelpersClient />
    </AppShell>
  );
}
