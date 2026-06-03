"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Card, CardBody } from "@heroui/react";
import { MailSearch } from "lucide-react";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to send reset email");
      }

      toast.success("If the account exists, a reset email has been sent");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grain min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
        <Card className="w-full border border-white/10 bg-black/30 shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <CardBody className="space-y-6 p-8 lg:p-10">
            <div className="eyebrow">Account recovery</div>
            <div className="flex items-center gap-3 text-white">
              <MailSearch className="h-5 w-5 text-[var(--color-brass)]" />
              <h1 className="text-3xl font-black tracking-tight">Reset your password</h1>
            </div>
            <p className="text-sm leading-7 text-[var(--color-sand-2)]">
              Enter the account email and Music Tool will send a password reset link.
            </p>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">Email</span>
                <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </label>
              <Button type="submit" radius="full" className="w-full bg-[var(--color-copper)] text-white" isLoading={submitting}>
                Send reset link
              </Button>
            </form>
            <div className="text-sm text-[var(--color-sand-2)]">
              Return to <Link href="/login" className="text-[var(--color-brass)] hover:text-white">login</Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}