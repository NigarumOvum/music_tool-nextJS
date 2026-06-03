"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, CardBody } from "@heroui/react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to reset password");
      }

      toast.success("Password updated");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grain min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
        <Card className="panel w-full rounded-[2.25rem] border-0 bg-transparent shadow-none">
          <CardBody className="space-y-6 p-8 lg:p-10">
            <div className="eyebrow">Account recovery</div>
            <div className="flex items-center gap-3 text-[var(--color-foreground)]">
              <KeyRound className="h-5 w-5 text-[var(--color-brass)]" />
              <h1 className="text-3xl font-black tracking-tight">Choose a new password</h1>
            </div>
            <p className="text-sm leading-7 text-[var(--color-sand-2)]">
              Set a new password for your Music Tool account.
            </p>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">New password</span>
                <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
              </label>
              <Button type="submit" radius="full" className="w-full bg-[var(--color-copper)] text-white shadow-[var(--shadow-soft)]" isLoading={submitting}>
                Update password
              </Button>
            </form>
            <div className="text-sm text-[var(--color-sand-2)]">
              Return to <Link href="/login" className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]">login</Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}