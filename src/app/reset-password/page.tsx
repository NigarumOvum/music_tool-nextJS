import Link from "next/link";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="grain min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
          <div className="panel w-full space-y-4 rounded-[2.25rem] p-8 text-[var(--color-sand-2)] lg:p-10">
              <div className="eyebrow">Account recovery</div>
              <h1 className="text-3xl font-black tracking-tight text-[var(--color-foreground)]">Reset link missing</h1>
              <p>The password reset link is incomplete. Request a new email and try again.</p>
              <Link href="/forgot-password" className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]">Request a new reset email</Link>
          </div>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}