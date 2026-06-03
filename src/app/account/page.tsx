import { AppShell } from "@/components/app-shell";
import { AccountClient } from "@/components/account/account-client";
import { requireCurrentUser } from "@/lib/auth";

type AccountPageProps = {
  searchParams: Promise<{ denied?: string }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await requireCurrentUser();
  const { denied } = await searchParams;

  return (
    <AppShell
      title="Account"
      eyebrow="Identity"
      description="Review your account details and, if you are the admin, grant or revoke access to each studio page for registered users."
    >
      <AccountClient currentUser={user} deniedPage={denied} />
    </AppShell>
  );
}