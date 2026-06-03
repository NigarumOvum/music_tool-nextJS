import Link from "next/link";
import { redirect } from "next/navigation";

import { VerifyEmailClient } from "@/components/auth/verify-email-client";
import { getCurrentUser } from "@/lib/auth";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const { token } = await searchParams;

  return (
    <div className="grain min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
        {token ? (
          <VerifyEmailClient token={token} />
        ) : (
          <div className="panel w-full space-y-4 rounded-[2.25rem] p-8 text-[var(--color-sand-2)] lg:p-10">
            <div className="eyebrow">Account verification</div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--color-foreground)]">Email confirmation failed</h1>
            <p>The confirmation link is missing or invalid. Request another confirmation email from the login screen.</p>
            <Link href="/login" className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]">Go to login</Link>
          </div>
        )}
      </div>
    </div>
  );
}