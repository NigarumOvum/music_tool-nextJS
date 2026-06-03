import { AppShell } from "@/components/app-shell";
import { DawClient } from "@/components/music/daw-client";

export default function DawPage() {
  return (
    <AppShell
      title="DAW Web App"
      eyebrow="Browser Session Lab"
      description="A browser-native DAW workspace for asset intake, layer rack management, and lightweight session exports without leaving the app."
    >
      <DawClient />
    </AppShell>
  );
}