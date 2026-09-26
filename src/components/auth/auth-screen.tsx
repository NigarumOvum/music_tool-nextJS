"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, CardBody } from "@heroui/react";
import { KeyRound, LockKeyhole, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/language-provider";

type AuthScreenProps = {
  mode: "login" | "register";
};

export function AuthScreen({ mode }: AuthScreenProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isRegister = mode === "register";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Authentication failed");
      }

      const fallback = (payload as { verificationUrl?: string }).verificationUrl;
      if (isRegister && fallback) {
        setFallbackLink(fallback);
        toast.success("Account created. Email delivery is paused, so confirm with the link below.");
        return;
      }

      toast.success(isRegister ? "Check your email to confirm your account" : "Logged in");
      router.replace(isRegister ? "/login" : "/");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendConfirmation() {    if (!email.trim()) {
      toast.error("Enter your email first");
      return;
    }

    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to resend confirmation");
      }

      const fallback = (payload as { verificationUrl?: string }).verificationUrl;
      if (fallback) {
        setFallbackLink(fallback);
        toast.success("Email delivery is paused — use the link below to confirm.");
        return;
      }

      toast.success("If the account exists, a confirmation email has been sent");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setResending(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextPassword !== confirmPassword) {
      toast.error(t("account.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword, nextPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to change password");
      }
      setChangingPassword(false);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setPassword("");
      toast.success(t("auth.passwordChangedLogin"));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grain min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <Card className="panel w-full max-w-5xl overflow-hidden rounded-[2.25rem] border-0 bg-transparent shadow-none">
          <CardBody className="grid gap-0 p-0 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="order-2 border-t border-[var(--color-border)] bg-[linear-gradient(155deg,var(--color-info-surface),transparent_58%)] p-6 sm:p-8 lg:order-1 lg:border-r lg:border-t-0 lg:p-10 xl:p-12">
              <div className="eyebrow">Music Tool</div>
              <h1 className="mt-4 max-w-[11ch] text-4xl font-black tracking-[-0.05em] text-[var(--color-foreground)] sm:max-w-none sm:text-5xl">
                {isRegister ? t("auth.createTitle") : t("auth.loginTitle")}
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-[var(--color-sand-2)]">
                The full app is now private to authenticated users. Confirm your email to activate your account, then sign in to access the Production Studio, Music Toolkit, and Prompt Library.
              </p>
              <div className="mt-8 space-y-3 text-sm text-[var(--color-sand-2)]">
                <div className="glass-card-soft rounded-[1.5rem] px-4 py-4">Private access to the full studio dashboard</div>
                <div className="glass-card-soft rounded-[1.5rem] px-4 py-4">User-scoped templates, snapshots, and partitures</div>
                <div className="glass-card-soft rounded-[1.5rem] px-4 py-4">Shared Turso-backed song catalog with protected APIs</div>
              </div>
            </section>
            <section className="order-1 p-6 sm:p-8 lg:order-2 lg:p-10 xl:p-12">
              {changingPassword && !isRegister ? (
              <form className="space-y-4" onSubmit={handleChangePassword}>
                <div className="flex items-center gap-3 text-[var(--color-foreground)]">
                  <KeyRound className="h-5 w-5 text-[var(--color-brass)]" />
                  <span className="text-xl font-bold">{t("auth.changePasswordTitle")}</span>
                </div>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">{t("auth.email")}</span>
                  <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">{t("auth.currentPassword")}</span>
                  <input className="field" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="••••••••" />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">{t("auth.newPassword")}</span>
                  <input className="field" type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} placeholder={t("auth.passPh")} />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">{t("auth.confirmNew")}</span>
                  <input className="field" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t("auth.passPh")} />
                </label>
                <Button type="submit" radius="full" className="w-full bg-[var(--color-copper)] text-white shadow-[var(--shadow-soft)]" isLoading={submitting}>
                  {t("auth.updatePassword")}
                </Button>
                <div className="text-sm text-[var(--color-sand-2)]">
                  <button
                    type="button"
                    onClick={() => setChangingPassword(false)}
                    className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]"
                  >
                    {t("auth.backToLogin")}
                  </button>
                </div>
              </form>
              ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="flex items-center gap-3 text-[var(--color-foreground)]">
                  {isRegister ? <UserRoundPlus className="h-5 w-5 text-[var(--color-brass)]" /> : <LockKeyhole className="h-5 w-5 text-[var(--color-brass)]" />}
                  <span className="text-xl font-bold">{isRegister ? t("auth.register") : t("auth.login")}</span>
                </div>
                {isRegister ? (
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">{t("auth.name")}</span>
                    <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("auth.namePh")} />
                  </label>
                ) : null}
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">{t("auth.email")}</span>
                  <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">{t("auth.password")}</span>
                  <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("auth.passPh")} />
                </label>
                <Button type="submit" radius="full" className="w-full bg-[var(--color-copper)] text-white shadow-[var(--shadow-soft)]" isLoading={submitting}>
                  {isRegister ? t("auth.createAccount") : t("auth.login")}
                </Button>
                {!isRegister ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-sand-2)]">
                    <Link href="/forgot-password" className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]">
                      {t("auth.forgot")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setChangingPassword(true)}
                      className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]"
                    >
                      {t("auth.changePassword")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleResendConfirmation()}
                      className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]"
                      disabled={resending}
                    >
                      {resending ? t("common.loading") : t("auth.resend")}
                    </button>
                  </div>
                ) : null}
                <div className="text-sm text-[var(--color-sand-2)]">
                  {isRegister ? t("auth.hasAccount") : t("auth.needAccount")}{" "}
                  <Link href={isRegister ? "/login" : "/register"} className="text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]">
                    {isRegister ? t("auth.signIn") : t("auth.register")}
                  </Link>
                </div>
              </form>
              )}
              {fallbackLink ? (
                <div className="mt-6 space-y-3 rounded-[1.5rem] border border-[var(--color-brass)]/30 bg-[var(--color-info-surface)] p-4 text-sm text-[var(--color-sand-2)]">
                  <p className="font-semibold text-[var(--color-foreground)]">Email delivery is paused</p>
                  <p>Your account is ready. Use the link below to confirm your email, then log in:</p>
                  <a href={fallbackLink} className="block break-all text-[var(--color-brass)] underline transition hover:text-[var(--color-foreground)]">
                    {fallbackLink}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(fallbackLink);
                      toast.success("Confirmation link copied");
                    }}
                    className="rounded-full bg-[var(--color-copper)] px-4 py-2 text-white shadow-[var(--shadow-soft)]"
                  >
                    Copy link
                  </button>
                </div>
              ) : null}
            </section>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}