import { AppShell } from "@/components/app-shell";
import { TemplatesClient } from "@/components/music/templates-client";

export default function TemplatesPage() {
  return (
    <AppShell
      title="Templates"
      eyebrow="Reusable Workflows"
      description="Create and manage reusable music enhancement templates for field rewrites, section passes, and layer cleanups."
      pageKey="templates"
    >
      <TemplatesClient />
    </AppShell>
  );
}