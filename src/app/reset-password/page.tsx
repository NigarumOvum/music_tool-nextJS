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
          <div className="w-full space-y-4 rounded-[2rem] border border-white/10 bg-black/30 p-8 text-[var(--color-sand-2)] shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-xl lg:p-10">
              <div className="eyebrow">Account recovery</div>
              <h1 className="text-3xl font-black tracking-tight text-white">Reset link missing</h1>
              <p>The password reset link is incomplete. Request a new email and try again.</p>
              <Link href="/forgot-password" className="text-[var(--color-brass)] hover:text-white">Request a new reset email</Link>
          </div>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}