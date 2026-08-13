import { AppShell } from "@/components/app-shell";
import { AccountClient } from "@/components/account/account-client";
import { MANAGEABLE_PAGES, type ManagedPageKey } from "@/lib/access";
import { ensureUserCanAccessPage, requireCurrentUser } from "@/lib/auth";

type AccountPageProps = {
  searchParams: Promise<{ denied?: string }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await requireCurrentUser();
  const { denied } = await searchParams;
  const pageAccessEntries = await Promise.all(
    MANAGEABLE_PAGES.map(async (page) => [page.key, await ensureUserCanAccessPage(user, page.key)] as const),
  );
  const pageAccess = Object.fromEntries(pageAccessEntries) as Record<ManagedPageKey, boolean>;

  return (
    <AppShell
      title="Account"
      eyebrow="Identity"
      description="Review your account details and, if you are the admin, grant or revoke access to each studio page for registered users."
    >
      <AccountClient currentUser={user} deniedPage={denied} pageAccess={pageAccess} />
    </AppShell>
  );
}