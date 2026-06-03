"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import type { ManagedPageKey } from "@/lib/access";

type PageDefinition = {
  key: ManagedPageKey;
  label: string;
  href: string;
};

type RegisteredUserAccess = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: string | null;
  isAdmin: boolean;
  pageAccess: Record<ManagedPageKey, boolean>;
};

type AccountClientProps = {
  currentUser: {
    email: string;
    name: string | null;
    emailVerifiedAt: string | null;
    isAdmin: boolean;
  };
  deniedPage?: string;
};

export function AccountClient({ currentUser, deniedPage }: AccountClientProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "access">("profile");
  const [pages, setPages] = useState<PageDefinition[]>([]);
  const [users, setUsers] = useState<RegisteredUserAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser.isAdmin) {
      return;
    }

    let cancelled = false;

    async function loadAccess() {
      setLoading(true);
      try {
        const response = await fetch("/api/account/access", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((payload as { error?: string }).error || "Failed to load access settings");
        }

        if (!cancelled) {
          setPages((payload as { pages?: PageDefinition[] }).pages || []);
          setUsers((payload as { users?: RegisteredUserAccess[] }).users || []);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [currentUser.isAdmin]);

  async function handleToggle(userId: string, pageKey: ManagedPageKey, canAccess: boolean) {
    const targetKey = `${userId}:${pageKey}`;
    setSavingKey(targetKey);
    try {
      const response = await fetch("/api/account/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pageKey, canAccess }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to update access");
      }

      setUsers((current) => current.map((user) => (
        user.id === userId ? { ...user, pageAccess: { ...user.pageAccess, [pageKey]: canAccess } } : user
      )));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${activeTab === "profile" ? "border-[var(--color-copper)] bg-[rgba(194,121,63,0.2)] text-white" : "border-white/10 bg-white/5 text-[var(--color-sand-2)]"}`}
        >
          Profile
        </button>
        {currentUser.isAdmin ? (
          <button
            type="button"
            onClick={() => setActiveTab("access")}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${activeTab === "access" ? "border-[var(--color-copper)] bg-[rgba(194,121,63,0.2)] text-white" : "border-white/10 bg-white/5 text-[var(--color-sand-2)]"}`}
          >
            Access Control
          </button>
        ) : null}
      </div>

      {activeTab === "profile" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {deniedPage ? (
            <div className="rounded-[1.5rem] border border-amber-400/30 bg-amber-500/10 p-5 text-sm text-[var(--color-sand-1)] md:col-span-2 xl:col-span-4">
              Your account does not currently have access to <span className="font-semibold">{deniedPage}</span>. Ask the admin to enable that page from Access Control.
            </div>
          ) : null}
          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">Email</div>
            <p className="mt-3 text-lg font-semibold text-white">{currentUser.email}</p>
          </div>
          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">Name</div>
            <p className="mt-3 text-lg font-semibold text-white">{currentUser.name || "Not set"}</p>
          </div>
          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">Verification</div>
            <p className="mt-3 text-lg font-semibold text-white">{currentUser.emailVerifiedAt ? "Verified" : "Pending"}</p>
          </div>
          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">Role</div>
            <p className="mt-3 text-lg font-semibold text-white">{currentUser.isAdmin ? "Admin" : "Member"}</p>
          </div>
        </section>
      ) : null}

      {activeTab === "access" && currentUser.isAdmin ? (
        <section className="space-y-4">
          <div className="panel rounded-[1.5rem] p-5 text-sm text-[var(--color-sand-2)]">
            Admin access is fixed. Toggle page access for other registered users below.
          </div>
          {loading ? (
            <div className="panel rounded-[1.5rem] p-5 text-[var(--color-sand-2)]">Loading access settings...</div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="panel rounded-[1.5rem] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{user.name || user.email}</p>
                    <p className="text-sm text-[var(--color-sand-2)]">{user.email}</p>
                  </div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-brass)]">
                    {user.isAdmin ? "Admin" : user.emailVerifiedAt ? "Verified" : "Pending verification"}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {pages.map((page) => {
                    const enabled = user.pageAccess[page.key];
                    const disabled = user.isAdmin;
                    const rowKey = `${user.id}:${page.key}`;
                    return (
                      <button
                        key={page.key}
                        type="button"
                        disabled={disabled || savingKey === rowKey}
                        onClick={() => void handleToggle(user.id, page.key, !enabled)}
                        className={`rounded-[1.25rem] border p-4 text-left transition ${enabled ? "border-emerald-400/40 bg-emerald-500/10 text-white" : "border-white/10 bg-white/5 text-[var(--color-sand-2)]"} ${disabled ? "opacity-60" : "hover:border-[var(--color-copper)]"}`}
                      >
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-brass)]">{page.label}</div>
                        <div className="mt-2 text-sm font-semibold">{enabled ? "Access granted" : "Access blocked"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}