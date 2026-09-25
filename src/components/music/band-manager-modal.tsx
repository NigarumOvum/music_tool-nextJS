"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Trash2, Check, Sparkles, ChevronDown } from "lucide-react";
import { Spinner } from "@heroui/react";
import { toast } from "sonner";

import { createProject, updateProject, deleteProject, fetchCollaborators } from "@/lib/music/client";
import type { MusicCollaboratorUser, MusicProjectRecord } from "@/lib/music/types";

const COLOR_PRESETS = [
  // Reds
  { name: "Crimson Red", hex: "#dc2626" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Hot Pink", hex: "#ff1493" },
  { name: "Coral", hex: "#ff6b6b" },
  { name: "Salmon", hex: "#fa8072" },
  { name: "Terra Cotta", hex: "#e2725b" },
  { name: "Burnt Orange", hex: "#cc5500" },

  // Oranges
  { name: "Neon Amber", hex: "#f59e0b" },
  { name: "Sunset Orange", hex: "#f97316" },
  { name: "Tangerine", hex: "#ff9500" },
  { name: "Peach", hex: "#ffb347" },
  { name: "Apricot", hex: "#fbceb1" },
  { name: "Gold", hex: "#ffd700" },
  { name: "Dark Gold", hex: "#c5a059" },
  { name: "Bronze", hex: "#cd7f32" },

  // Yellows
  { name: "Canary", hex: "#ffef00" },
  { name: "Lemon", hex: "#fff44f" },
  { name: "Banana", hex: "#ffe135" },
  { name: "Vanilla", hex: "#f3e5ab" },
  { name: "Mustard", hex: "#ffdb58" },
  { name: "Butter", hex: "#f6e7bc" },
  { name: "Cream", hex: "#fffdd0" },
  { name: "Ivory", hex: "#fffff0" },

  // Greens
  { name: "Emerald", hex: "#10b981" },
  { name: "Forest", hex: "#228b22" },
  { name: "Mint", hex: "#98fb98" },
  { name: "Teal", hex: "#008080" },
  { name: "Sea Green", hex: "#2e8b57" },
  { name: "Olive", hex: "#808000" },
  { name: "Lime", hex: "#32cd32" },
  { name: "Chartreuse", hex: "#7fff00" },

  // Cyans
  { name: "Electric Cyan", hex: "#06b6d4" },
  { name: "Turquoise", hex: "#40e0d0" },
  { name: "Aqua", hex: "#00ffff" },
  { name: "Sky Blue", hex: "#87ceeb" },
  { name: "Powder Blue", hex: "#b0e0e6" },
  { name: "Alice Blue", hex: "#f0f8ff" },
  { name: "Baby Blue", hex: "#89cff0" },
  { name: "Light Blue", hex: "#add8e6" },

  // Blues
  { name: "Cobalt Blue", hex: "#3b82f6" },
  { name: "Royal Blue", hex: "#4169e1" },
  { name: "Navy", hex: "#000080" },
  { name: "Midnight", hex: "#191970" },
  { name: "Steel Blue", hex: "#4682b4" },
  { name: "Slate Blue", hex: "#6a5acd" },
  { name: "Indigo", hex: "#4b0082" },
  { name: "Cornflower", hex: "#6495ed" },

  // Purples
  { name: "Royal Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#800080" },
  { name: "Lavender", hex: "#e6e6fa" },
  { name: "Thistle", hex: "#d8bfd8" },
  { name: "Plum", hex: "#dda0dd" },
  { name: "Orchid", hex: "#da70d6" },
  { name: "Fuchsia", hex: "#ff00ff" },
  { name: "Magenta", hex: "#ff00ff" },

  // Violets
  { name: "Violet", hex: "#ee82ee" },
  { name: "Periwinkle", hex: "#ccccff" },
  { name: "Iris", hex: "#5a4fcf" },
  { name: "Heliotrope", hex: "#df73ff" },
  { name: "Amethyst", hex: "#9966cc" },
  { name: "Grape", hex: "#6f2da8" },
  { name: "Mulberry", hex: "#c54b8b" },
  { name: "Wisteria", hex: "#c9a0dc" },

  // Pinks
  { name: "Hot Pink", hex: "#ff69b4" },
  { name: "Deep Pink", hex: "#ff1493" },
  { name: "Pale Pink", hex: "#ffd6dc" },
  { name: "Rose", hex: "#ff007f" },
  { name: "Blossom", hex: "#ffb7c5" },
  { name: "Blush", hex: "#de5d83" },
  { name: "Carnation", hex: "#ff4040" },
  { name: "Ruby", hex: "#e0115f" },

  // Browns
  { name: "Chocolate", hex: "#d2691e" },
  { name: "Sienna", hex: "#a0522d" },
  { name: "Saddle Brown", hex: "#8b4513" },
  { name: "Coffee", hex: "#6f4e37" },
  { name: "Mocha", hex: "#c2b280" },
  { name: "Tan", hex: "#d2b48c" },
  { name: "Beige", hex: "#f5f5dc" },
  { name: "Khaki", hex: "#c3b091" },

  // Grays
  { name: "Silver", hex: "#c0c0c0" },
  { name: "Platinum", hex: "#e5e4e2" },
  { name: "Gray", hex: "#808080" },
  { name: "Slate", hex: "#708090" },
  { name: "Charcoal", hex: "#36454f" },
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#ffffff" },
  { name: "Off White", hex: "#fafafa" },

  // Neons
  { name: "Neon Green", hex: "#39ff14" },
  { name: "Neon Pink", hex: "#ff6ff2" },
  { name: "Neon Blue", hex: "#1f51ff" },
  { name: "Neon Purple", hex: "#bc13fe" },
  { name: "Neon Orange", hex: "#ff5f1f" },
  { name: "Neon Yellow", hex: "#dfff00" },
  { name: "Neon Red", hex: "#ff073a" },
  { name: "Neon Cyan", hex: "#00ffff" },
];

// Group colors by category for better organization
const COLOR_CATEGORIES = [
  { name: "Reds", colors: COLOR_PRESETS.slice(0, 8) },
  { name: "Oranges", colors: COLOR_PRESETS.slice(8, 16) },
  { name: "Yellows", colors: COLOR_PRESETS.slice(16, 24) },
  { name: "Greens", colors: COLOR_PRESETS.slice(24, 32) },
  { name: "Cyans", colors: COLOR_PRESETS.slice(32, 40) },
  { name: "Blues", colors: COLOR_PRESETS.slice(40, 48) },
  { name: "Purples", colors: COLOR_PRESETS.slice(48, 56) },
  { name: "Violets", colors: COLOR_PRESETS.slice(56, 64) },
  { name: "Pinks", colors: COLOR_PRESETS.slice(64, 72) },
  { name: "Browns", colors: COLOR_PRESETS.slice(72, 80) },
  { name: "Grays", colors: COLOR_PRESETS.slice(80, 88) },
  { name: "Neons", colors: COLOR_PRESETS.slice(88, 96) },
];

type BandManagerModalProps = {
  isOpen: boolean;
  projectToEdit?: MusicProjectRecord | null;
  onClose: () => void;
  onSaved: (project: MusicProjectRecord) => void;
  onDeleted?: (projectId: string) => void;
};

export function BandManagerModal({
  isOpen,
  projectToEdit,
  onClose,
  onSaved,
  onDeleted,
}: BandManagerModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [customColorInput, setCustomColorInput] = useState("#f59e0b");
  const [colorCategoryOpen, setColorCategoryOpen] = useState<string | null>(null);
  const [isSharedWithAll, setIsSharedWithAll] = useState(true);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [collaborators, setCollaborators] = useState<MusicCollaboratorUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (projectToEdit) {
        setName(projectToEdit.name);
        setDescription(projectToEdit.description || "");
        setColor(projectToEdit.color || "#f59e0b");
        setCustomColorInput(projectToEdit.color || "#f59e0b");
        setIsSharedWithAll(projectToEdit.isSharedWithAll);
        setSelectedMemberIds(projectToEdit.members.map((m) => m.userId));
      } else {
        setName("");
        setDescription("");
        setColor("#f59e0b");
        setCustomColorInput("#f59e0b");
        setIsSharedWithAll(true);
        setSelectedMemberIds([]);
      }

      setLoadingUsers(true);
      fetchCollaborators()
        .then((res) => setCollaborators(res.users || []))
        .catch(() => {})
        .finally(() => setLoadingUsers(false));
    }
  }, [isOpen, projectToEdit]);

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a band or project name");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        isSharedWithAll,
        memberUserIds: selectedMemberIds,
      };

      if (projectToEdit) {
        const res = await updateProject(projectToEdit.id, payload);
        toast.success(`Band "${res.project.name}" updated`);
        onSaved(res.project);
      } else {
        const res = await createProject(payload);
        toast.success(`Band "${res.project.name}" created`);
        onSaved(res.project);
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Failed to save band/project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectToEdit) return;
    if (!confirm(`Are you sure you want to delete the band "${projectToEdit.name}"?`)) return;

    try {
      setDeleting(true);
      await deleteProject(projectToEdit.id);
      toast.success(`Band "${projectToEdit.name}" deleted`);
      onDeleted?.(projectToEdit.id);
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete band/project");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-stroke)] px-6 py-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 text-white shadow-md"
                  style={{ backgroundColor: color }}
                >
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="eyebrow text-[0.62rem] text-[var(--color-brass)]">
                    Band & Project Collaboration
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-[var(--color-foreground)]">
                    {projectToEdit ? "Manage Band / Project" : "Create Band / Project"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div className="space-y-1.5">
                <label className="field-label">Band / Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Neon Horizon, The Velvet Echoes, Cyberpunk EP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Brand / Accent Color</label>

                {/* Current color preview with hex input */}
                <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3">
                  <div
                    className="h-10 w-10 shrink-0 rounded-lg border-2 border-white/20 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={customColorInput}
                      onChange={(e) => {
                        const hex = e.target.value;
                        setCustomColorInput(hex);
                        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                          setColor(hex);
                        }
                      }}
                      onBlur={() => {
                        if (/^#[0-9A-Fa-f]{6}$/.test(customColorInput)) {
                          setColor(customColorInput);
                        } else {
                          setCustomColorInput(color);
                        }
                      }}
                      placeholder="#RRGGBB"
                      className="field text-xs font-mono py-2"
                    />
                    <div className="mt-1 text-[10px] text-[var(--color-sand-2)] font-mono">
                      RGB: {parseInt(color.slice(1, 3), 16)}, {parseInt(color.slice(3, 5), 16)}, {parseInt(color.slice(5, 7), 16)}
                    </div>
                  </div>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      setCustomColorInput(e.target.value);
                    }}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-[var(--color-border)] bg-transparent p-0"
                    title="Color picker"
                  />
                </div>

                {/* Color categories */}
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-2">
                  {COLOR_CATEGORIES.map((category) => (
                    <div key={category.name}>
                      <button
                        type="button"
                        onClick={() => setColorCategoryOpen(colorCategoryOpen === category.name ? null : category.name)}
                        className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface)] rounded-lg transition"
                      >
                        <span>{category.name}</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${colorCategoryOpen === category.name ? 'rotate-180' : ''}`} />
                      </button>
                      {colorCategoryOpen === category.name && (
                        <div className="mt-2 flex flex-wrap gap-1.5 px-2 pb-2">
                          {category.colors.map((preset) => (
                            <button
                              key={preset.hex}
                              type="button"
                              onClick={() => {
                                setColor(preset.hex);
                                setCustomColorInput(preset.hex);
                              }}
                              className={`relative flex h-7 w-7 items-center justify-center rounded-lg border-2 transition ${
                                color === preset.hex
                                  ? "scale-110 border-white shadow-md"
                                  : "border-transparent opacity-80 hover:opacity-100"
                              }`}
                              style={{ backgroundColor: preset.hex }}
                              title={`${preset.name} (${preset.hex})`}
                            >
                              {color === preset.hex && <Check className="h-3.5 w-3.5 text-white" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Description / Bio (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Musical direction, release goals, or member lineup..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="field text-xs resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="field-label mb-0">Select Band Collaborators</label>
                  <span className="text-[11px] text-[var(--color-sand-2)]">
                    {selectedMemberIds.length} selected
                  </span>
                </div>

                <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-2">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-6 text-xs text-[var(--color-sand-2)]">
                      <Spinner size="sm" color="warning" className="mr-2" /> Loading users...
                    </div>
                  ) : collaborators.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[var(--color-sand-2)]">
                      No other registered users found in workspace.
                    </p>
                  ) : (
                    collaborators.map((user) => {
                      const isSelected = selectedMemberIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => toggleMember(user.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                            isSelected
                              ? "border border-[var(--color-info-border)] bg-[var(--color-info-surface)] text-[var(--color-foreground)] font-semibold"
                              : "border border-transparent hover:bg-[var(--color-surface)] text-[var(--color-sand-2)]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black uppercase text-white shadow-xs"
                              style={{ backgroundColor: color }}
                            >
                              {(user.name || user.email).charAt(0)}
                            </div>
                            <div>
                              <div>{user.name || user.email}</div>
                              {user.name && (
                                <div className="text-[10px] opacity-60 font-normal">{user.email}</div>
                              )}
                            </div>
                          </div>

                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                              isSelected
                                ? "border-transparent bg-[var(--color-copper)] text-white"
                                : "border-[var(--color-border)]"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[var(--color-foreground)]">
                    Workspace-Wide Visibility
                  </div>
                  <div className="text-[11px] text-[var(--color-sand-2)]">
                    Allow all registered users in this private workspace to see songs assigned to this band
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isSharedWithAll}
                  onChange={(e) => setIsSharedWithAll(e.target.checked)}
                  className="h-4 w-4 rounded accent-[var(--color-brass)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--color-stroke)]">
                {projectToEdit ? (
                  <button
                    type="button"
                    disabled={deleting || saving}
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 rounded-xl border border-red-500/30 px-3.5 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {deleting ? <Spinner size="sm" color="danger" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete Band
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-5 py-2 text-xs font-bold text-black shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <Spinner size="sm" color="current" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {projectToEdit ? "Save Changes" : "Create Band"}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
