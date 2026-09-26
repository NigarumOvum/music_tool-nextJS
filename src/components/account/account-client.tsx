"use client";

import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";

import { LogoutButton } from "@/components/auth/logout-button";
import { useI18n } from "@/components/language-provider";
import { HUB_ACCESS_GROUPS, MANAGEABLE_PAGES, type ManagedPageKey } from "@/lib/access";

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
    id: string;
    email: string;
    name: string | null;
    emailVerifiedAt: string | null;
    isAdmin: boolean;
  };
  deniedPage?: string;
  emailChangeToken?: string;
  pageAccess: Record<ManagedPageKey, boolean>;
};

function getHubAccessSummary(pageAccess: Record<ManagedPageKey, boolean>) {
  return HUB_ACCESS_GROUPS.map((hub) => {
    const enabledCount = hub.pageKeys.filter((pageKey) => pageAccess[pageKey]).length;
    return {
      id: hub.id,
      label: hub.label,
      enabledCount,
      totalCount: hub.pageKeys.length,
      hasAccess: enabledCount > 0,
    };
  });
}

function buildFullPageAccessMap(enabled: boolean, pages: PageDefinition[]) {
  return Object.fromEntries(pages.map((page) => [page.key, enabled])) as Record<ManagedPageKey, boolean>;
}

export function AccountClient({ currentUser, deniedPage, emailChangeToken, pageAccess }: AccountClientProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"profile" | "access">("profile");
  const [pages, setPages] = useState<PageDefinition[]>(MANAGEABLE_PAGES.map((page) => ({ ...page })));
  const [users, setUsers] = useState<RegisteredUserAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editingNameUserId, setEditingNameUserId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // Change password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Change email form
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Auto-confirm a pending email change opened from the inbox link.
  useEffect(() => {
    if (!emailChangeToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/email/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: emailChangeToken }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((payload as { error?: string }).error || "Failed to confirm email change");
        }
        if (!cancelled) {
          const confirmedEmail = String((payload as { email?: string }).email ?? "");
          toast.success(t("account.emailChanged").replace("{email}", confirmedEmail));
          window.setTimeout(() => window.location.replace("/account"), 1200);
        }
      } catch (error) {
        if (!cancelled) toast.error((error as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailChangeToken]);

  const ownHubSummary = useMemo(() => getHubAccessSummary(pageAccess), [pageAccess]);

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
          setPages((payload as { pages?: PageDefinition[] }).pages || MANAGEABLE_PAGES.map((page) => ({ ...page })));
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

  async function handleBulkAccess(userId: string, enabled: boolean) {
    const targetKey = `${userId}:bulk`;
    const nextAccess = buildFullPageAccessMap(enabled, pages);
    setSavingKey(targetKey);
    try {
      const response = await fetch("/api/account/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pageAccess: nextAccess }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to update access");
      }

      setUsers((current) => current.map((user) => (
        user.id === userId ? { ...user, pageAccess: nextAccess } : user
      )));
      toast.success(enabled ? "All pages granted" : "All pages revoked");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveName(userId: string) {
    setSavingKey(`${userId}:name`);
    try {
      const response = await fetch("/api/account/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: draftName.trim() || null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to update user");
      }

      const nextName = draftName.trim() || null;
      setUsers((current) => current.map((user) => (
        user.id === userId ? { ...user, name: nextName } : user
      )));
      setEditingNameUserId(null);
      toast.success("User name updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  function startEditingName(user: RegisteredUserAccess) {
    setEditingNameUserId(user.id);
    setDraftName(user.name || "");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (nextPassword !== confirmPassword) {
      toast.error(t("account.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to change password");
      }
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      toast.success(t("account.passwordChanged"));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const response = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: emailPassword, newEmail }),
      });
      const payload = await response.json().catch(() => ({})) as { sent?: boolean; url?: string | null; newEmail?: string };
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to request email change");
      }
      setEmailPassword("");
      if (payload.sent) {
        toast.success(t("account.emailSent").replace("{email}", payload.newEmail || newEmail));
      } else if (payload.url) {
        toast.message(t("account.emailFallback"));
      }
      setNewEmail("");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingEmail(false);
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
          {t("account.profile")}
        </button>
        {currentUser.isAdmin ? (
          <button
            type="button"
            onClick={() => setActiveTab("access")}
            className={`glass-pill px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${activeTab === "access" ? "border-[var(--color-info-border)] bg-[var(--color-info-surface)] text-[var(--color-foreground)]" : "text-[var(--color-sand-2)] hover:-translate-y-0.5"}`}
          >
            {t("account.accessControl")}
          </button>
        ) : null}
      </div>

      {activeTab === "profile" ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {deniedPage ? (
              <div className="surface-warning rounded-[1.5rem] p-5 text-sm text-[var(--color-foreground)] md:col-span-2 xl:col-span-4">
                Your account does not currently have access to <span className="font-semibold">{deniedPage}</span>. Ask the admin to enable that page from Access Control.
              </div>
            ) : null}
            <div className="panel rounded-[1.5rem] p-5">
              <div className="eyebrow">{t("account.email")}</div>
              <p className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{currentUser.email}</p>
            </div>
            <div className="panel rounded-[1.5rem] p-5">
              <div className="eyebrow">{t("account.name")}</div>
              <p className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{currentUser.name || "Not set"}</p>
            </div>
            <div className="panel rounded-[1.5rem] p-5">
              <div className="eyebrow">{t("account.verification")}</div>
              <p className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{currentUser.emailVerifiedAt ? t("account.verified") : t("account.pending")}</p>
            </div>
            <div className="panel rounded-[1.5rem] p-5">
              <div className="eyebrow">{t("account.role")}</div>
              <p className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">{currentUser.isAdmin ? t("account.admin") : t("account.member")}</p>
            </div>
            <div className="panel rounded-[1.5rem] p-5 flex items-center justify-between">
              <div>
                <div className="eyebrow">{t("account.session")}</div>
                <p className="mt-3 text-sm text-[var(--color-sand-2)]">{t("account.logoutHint")}</p>
              </div>
              <LogoutButton />
            </div>
          </div>

          <div className="panel rounded-[1.5rem] p-5">
            <div className="eyebrow">{t("account.security")}</div>
            <p className="mt-2 text-sm text-[var(--color-sand-2)]">{t("account.securityHint")}</p>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-foreground)]">{t("account.changePassword")}</h3>
                <label className="field-group">
                  <span className="field-label">{t("account.currentPassword")}</span>
                  <input
                    type="password"
                    className="field"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label className="field-group">
                  <span className="field-label">{t("account.newPassword")}</span>
                  <input
                    type="password"
                    className="field"
                    value={nextPassword}
                    onChange={(e) => setNextPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <label className="field-group">
                  <span className="field-label">{t("account.confirmPassword")}</span>
                  <input
                    type="password"
                    className="field"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="glass-pill px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-foreground)] transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {t("account.updatePassword")}
                </button>
              </form>

              <form onSubmit={(e) => void handleChangeEmail(e)} className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-foreground)]">{t("account.changeEmail")}</h3>
                <label className="field-group">
                  <span className="field-label">{t("account.newEmail")}</span>
                  <input
                    type="email"
                    className="field"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={currentUser.email}
                    required
                  />
                </label>
                <label className="field-group">
                  <span className="field-label">{t("account.yourPassword")}</span>
                  <input
                    type="password"
                    className="field"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="glass-pill px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-foreground)] transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {t("account.sendConfirmation")}
                </button>
              </form>
            </div>
          </div>

          {!currentUser.isAdmin ? (
            <div className="panel rounded-[1.5rem] p-5">
              <div className="eyebrow">{t("account.yourAccess")}</div>
              <p className="mt-2 text-sm text-[var(--color-sand-2)]">{t("account.accessHint")}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {ownHubSummary.map((hub) => (
                  <div
                    key={hub.id}
                    className={`rounded-[1.25rem] border p-4 ${hub.hasAccess ? "surface-success text-[var(--color-foreground)]" : "glass-card-soft text-[var(--color-sand-2)]"}`}
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-brass)]">{hub.label}</div>
                    <div className="mt-2 text-sm font-semibold">
                      {hub.hasAccess ? `${hub.enabledCount}/${hub.totalCount} pages enabled` : "No access"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "access" && currentUser.isAdmin ? (
        <section className="space-y-4">
          <div className="glass-card-soft rounded-[1.5rem] p-5 text-sm text-[var(--color-sand-2)]">
            Admin access is fixed. Manage registered users below: edit display names, review hub access, and toggle individual pages. Passwords are never shown or editable here.
          </div>
          {loading ? (
            <div className="glass-card-soft rounded-[1.5rem] p-5 text-[var(--color-sand-2)]">Loading access settings...</div>
          ) : users.length === 0 ? (
            <div className="glass-card-soft rounded-[1.5rem] p-5 text-[var(--color-sand-2)]">No registered users yet.</div>
          ) : (
            users.map((user) => {
              const hubSummary = getHubAccessSummary(user.pageAccess);
              const isEditingName = editingNameUserId === user.id;
              const isSavingBulk = savingKey === `${user.id}:bulk`;
              const isSavingName = savingKey === `${user.id}:name`;

              return (
                <div key={user.id} className="panel rounded-[1.5rem] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      {isEditingName && !user.isAdmin ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={draftName}
                            onChange={(event) => setDraftName(event.target.value)}
                            placeholder="Display name"
                            className="glass-card-soft min-w-[220px] rounded-full px-4 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-info-border)]"
                          />
                          <button
                            type="button"
                            disabled={isSavingName}
                            onClick={() => void handleSaveName(user.id)}
                            className="glass-pill px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-foreground)] transition hover:-translate-y-0.5"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={isSavingName}
                            onClick={() => setEditingNameUserId(null)}
                            className="glass-pill px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-2)] transition hover:-translate-y-0.5"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-[var(--color-foreground)]">{user.name || user.email}</p>
                          {!user.isAdmin ? (
                            <button
                              type="button"
                              onClick={() => startEditingName(user)}
                              className="text-xs uppercase tracking-[0.18em] text-[var(--color-brass)] transition hover:text-[var(--color-foreground)]"
                            >
                              Edit name
                            </button>
                          ) : null}
                        </div>
                      )}
                      <p className="text-sm text-[var(--color-sand-2)]">{user.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-brass)]">
                        {user.isAdmin ? "Admin" : user.emailVerifiedAt ? "Verified" : "Pending verification"}
                      </div>
                      {!user.isAdmin ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={isSavingBulk}
                            onClick={() => void handleBulkAccess(user.id, true)}
                            className="glass-pill px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-foreground)] transition hover:-translate-y-0.5"
                          >
                            Grant all
                          </button>
                          <button
                            type="button"
                            disabled={isSavingBulk}
                            onClick={() => void handleBulkAccess(user.id, false)}
                            className="glass-pill px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-2)] transition hover:-translate-y-0.5"
                          >
                            Revoke all
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {hubSummary.map((hub) => (
                      <div
                        key={hub.id}
                        className={`rounded-[1.25rem] border p-4 ${hub.hasAccess ? "surface-success text-[var(--color-foreground)]" : "glass-card-soft text-[var(--color-sand-2)]"}`}
                      >
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-brass)]">{hub.label}</div>
                        <div className="mt-2 text-sm font-semibold">
                          {user.isAdmin ? "Full hub access" : hub.hasAccess ? `${hub.enabledCount}/${hub.totalCount} pages` : "Blocked"}
                        </div>
                      </div>
                    ))}
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
                          disabled={disabled || savingKey === rowKey || isSavingBulk}
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
              );
            })
          )}
        </section>
      ) : null}
    </div>
  );
}
