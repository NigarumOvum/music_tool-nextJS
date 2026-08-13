import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ProductionStudioClient } from "@/components/music/production-studio-client";
import {
  getAllowedProductionStudioTabs,
  resolveProductionStudioTab,
  type ProductionStudioTabId,
} from "@/lib/hub-access";
import { requireCurrentUser } from "@/lib/auth";

type ProductionStudioPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function ProductionStudioPage({ searchParams }: ProductionStudioPageProps) {
  const user = await requireCurrentUser();
  const allowedTabs = await getAllowedProductionStudioTabs(user);

  if (allowedTabs.length === 0) {
    redirect("/account?denied=production-studio");
  }

  const { tab } = await searchParams;
  const initialTab = resolveProductionStudioTab(tab, allowedTabs);

  return (
    <AppShell
      title="Production Studio"
      eyebrow="Song workspace"
      description="Lyrics, song records, browser audio sessions, and tab notation in one place. Tabs respect your existing page access settings."
    >
      <ProductionStudioClient
        allowedTabs={allowedTabs.map((entry) => ({
          id: entry.id as ProductionStudioTabId,
          label: entry.label,
        }))}
        initialTab={initialTab}
      />
    </AppShell>
  );
}
