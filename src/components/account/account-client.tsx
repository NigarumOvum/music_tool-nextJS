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
          className={`glass-pill px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${activeTab === "profile" ? "border-[var(--color-info-border)] bg-[var(--color-info-surface)] text-[var(--color-foreground)]" : "text-[var(--color-sand-2)] hover:-translate-y-0.5"}`}
        >
          Profile
        </button>
        {currentUser.isAdmin ? (
          <button
            type="button"
            onClick={() => setActiveTab("access")}
            className={`glass-pill px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${activeTab === "access" ? "border-[var(--color-info-border)] bg-[var(--color-info-surface)] text-[var(--color-foreground)]" : "text-[var(--color-sand-2)] hover:-translate-y-0.5"}`}
          >
            Access Control
          </button>
        ) : null}
      </div>

      {activeTab === "profile" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {deniedPage ? (
            <div className="surface-warning rounded-[1.5rem] p-5 text-sm text-[var(--color-foreground)] md:col-span-2 xl:col-span-4">
              Your account does not currently have access to <span className="font-semibold">{deniedPage}</span>. Ask the admin to enable that page from Access Control.
            </div>
          ) : null}
          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">Email</div>
            <p className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{currentUser.email}</p>
          </div>
          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">Name</div>
            <p className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{currentUser.name || "Not set"}</p>
          </div>
          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">Verification</div>
            <p className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{currentUser.emailVerifiedAt ? "Verified" : "Pending"}</p>
          </div>
          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">Role</div>
            <p className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{currentUser.isAdmin ? "Admin" : "Member"}</p>
          </div>
        </section>
      ) : null}

      {activeTab === "access" && currentUser.isAdmin ? (
        <section className="space-y-4">
          <div className="glass-card-soft rounded-[1.5rem] p-5 text-sm text-[var(--color-sand-2)]">
            Admin access is fixed. Toggle page access for other registered users below.
          </div>
          {loading ? (
            <div className="glass-card-soft rounded-[1.5rem] p-5 text-[var(--color-sand-2)]">Loading access settings...</div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="panel rounded-[1.5rem] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                  <div>
                    <p className="text-lg font-semibold text-[var(--color-foreground)]">{user.name || user.email}</p>
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
                        className={`rounded-[1.25rem] border p-4 text-left transition ${enabled ? "surface-success text-[var(--color-foreground)]" : "glass-card-soft text-[var(--color-sand-2)]"} ${disabled ? "opacity-60" : "hover:-translate-y-0.5 hover:border-[var(--color-info-border)]"}`}
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