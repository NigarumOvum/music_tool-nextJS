"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Card, CardBody } from "@heroui/react";
import { MailSearch } from "lucide-react";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);

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

      const fallback = (payload as { resetUrl?: string }).resetUrl;
      if (fallback) {
        setFallbackLink(fallback);
        toast.success("Email delivery is paused — use the link below to reset.");
        return;
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
        <Card className="panel w-full rounded-[2.25rem] border-0 bg-transparent shadow-none">
          <CardBody className="space-y-6 p-8 lg:p-10">
            <div className="eyebrow">Account recovery</div>
            <div className="flex items-center gap-3 text-[var(--color-foreground)]">
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
              <Button type="submit" radius="full" className="w-full bg-[var(--color-copper)] text-white shadow-[var(--shadow-soft)]" isLoading={submitting}>
                Send reset link
              </Button>
            </form>
            {fallbackLink ? (
              <div className="space-y-3 rounded-[1.5rem] border border-[var(--color-brass)]/30 bg-[var(--color-info-surface)] p-4 text-sm text-[var(--color-sand-2)]">
                <p className="font-semibold text-[var(--color-foreground)]">Email delivery is paused</p>
                <p>Use the link below to reset your password:</p>
                <a href={fallbackLink} className="block break-all text-[var(--color-brass)] underline transition hover:text-[var(--color-foreground)]">
                  {fallbackLink}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(fallbackLink);
                    toast.success("Reset link copied");
                  }}
                  className="rounded-full bg-[var(--color-copper)] px-4 py-2 text-white shadow-[var(--shadow-soft)]"
                >
                  Copy link
                </button>
              </div>
            ) : null}
            <div className="text-sm text-[var(--color-sand-2)]">
              Return to <Link href="/login" className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]">login</Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}