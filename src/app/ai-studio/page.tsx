import { AppShell } from "@/components/app-shell";
import { AiStudioClient } from "@/components/music/ai-studio-client";

export default function AiStudioPage() {
  return (
    <AppShell
      title="AI Studio"
      eyebrow="Generation + Rewrite"
      description="Generate structured song drafts and preview targeted field rewrites before applying them to the catalog."
    >
      <AiStudioClient />
    </AppShell>
  );
}