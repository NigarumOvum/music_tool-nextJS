"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@heroui/react";
import { toast } from "sonner";

type VerifyEmailClientProps = {
  token: string;
};

export function VerifyEmailClient({ token }: VerifyEmailClientProps) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("Click below to confirm your Music Tool account.");

  async function handleVerify() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to confirm email");
      }

      setStatus("success");
      setMessage("Your Music Tool account is verified. You can log in now.");
      toast.success("Email confirmed");
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message || "Failed to confirm email");
      toast.error((error as Error).message || "Failed to confirm email");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-4 rounded-[2rem] border border-white/10 bg-black/30 p-8 text-[var(--color-sand-2)] shadow-[0_24px_90px_rgba(0,0,0,0.3)] backdrop-blur-xl lg:p-10">
      <div className="eyebrow">Account verification</div>
      <h1 className="text-3xl font-black tracking-tight text-white">
        {status === "success" ? "Email confirmed" : "Confirm your email"}
      </h1>
      <p>{message}</p>
      {status !== "success" ? (
        <Button type="button" radius="full" className="bg-[var(--color-copper)] text-white" isLoading={submitting} onPress={() => void handleVerify()}>
          Confirm email
        </Button>
      ) : null}
      <Link href="/login" className="inline-block text-[var(--color-brass)] hover:text-white">Go to login</Link>
    </div>
  );
}