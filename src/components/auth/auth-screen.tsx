"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, CardBody } from "@heroui/react";
import { LockKeyhole, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

type AuthScreenProps = {
  mode: "login" | "register";
};

export function AuthScreen({ mode }: AuthScreenProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

      toast.success(isRegister ? "Account created" : "Logged in");
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grain min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <Card className="w-full max-w-5xl border border-white/10 bg-black/30 shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <CardBody className="grid gap-0 p-0 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="border-b border-white/10 bg-[linear-gradient(160deg,rgba(194,121,63,0.28),rgba(159,201,180,0.14),rgba(19,17,15,0.1))] p-8 lg:border-b-0 lg:border-r lg:p-10">
              <div className="eyebrow">Music Tool</div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
                {isRegister ? "Create your studio account" : "Sign in to your studio"}
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-[var(--color-sand-2)]">
                The full app is now private to authenticated users. Sign in to access Song Studio, Lyrics Library, AI tools, Web DAW, and the tab workflow pages.
              </p>
              <div className="mt-8 space-y-3 text-sm text-[var(--color-sand-2)]">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">Private access to the full studio dashboard</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">User-scoped templates, snapshots, and partitures</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">Shared Turso-backed song catalog with protected APIs</div>
              </div>
            </section>
            <section className="p-8 lg:p-10">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="flex items-center gap-3 text-white">
                  {isRegister ? <UserRoundPlus className="h-5 w-5 text-[var(--color-brass)]" /> : <LockKeyhole className="h-5 w-5 text-[var(--color-brass)]" />}
                  <span className="text-xl font-bold">{isRegister ? "Register" : "Login"}</span>
                </div>
                {isRegister ? (
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">Name</span>
                    <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Artist or producer name" />
                  </label>
                ) : null}
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">Email</span>
                  <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-sand-2)]">Password</span>
                  <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
                </label>
                <Button type="submit" radius="full" className="w-full bg-[var(--color-copper)] text-white" isLoading={submitting}>
                  {isRegister ? "Create account" : "Login"}
                </Button>
                <div className="text-sm text-[var(--color-sand-2)]">
                  {isRegister ? "Already have an account?" : "Need an account?"}{" "}
                  <Link href={isRegister ? "/login" : "/register"} className="text-[var(--color-brass)] hover:text-white">
                    {isRegister ? "Sign in" : "Register"}
                  </Link>
                </div>
              </form>
            </section>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}