"use client";

import { useState, type ReactNode, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export type CollapsibleCardProps = {
  title: ReactNode;
  subtitle?: string;
  eyebrow?: string;
  eyebrowColor?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  headerActions?: ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
  variant?: "default" | "subtle" | "glass" | "bordered";
};

export function CollapsibleCard({
  title,
  subtitle,
  eyebrow,
  eyebrowColor,
  icon,
  badge,
  headerActions,
  defaultOpen = true,
  isOpen: controlledOpen,
  onToggle,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  children,
  variant = "default",
}: CollapsibleCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isExpanded = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleToggle = () => {
    const next = !isExpanded;
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  };

  const handleActionsClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const variantStyles = {
    default: "panel glass-shine rounded-[1.4rem]",
    glass: "glass-card-soft rounded-[1.4rem]",
    subtle: "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)]/50",
    bordered: "rounded-2xl border border-[var(--color-stroke)] bg-transparent",
  }[variant];

  return (
    <div className={`group overflow-hidden transition-all duration-200 ${variantStyles} ${className}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={`collapsible-header flex cursor-pointer items-center justify-between gap-3 px-5 py-4 transition-colors ${
          isExpanded ? "border-b border-[var(--color-stroke)]/40" : ""
        } ${headerClassName}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] text-[var(--color-foreground)] shadow-xs">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="eyebrow text-[0.62rem] opacity-75" style={{ color: eyebrowColor || undefined }}>{eyebrow}</div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-bold tracking-tight text-[var(--color-foreground)]">
                {title}
              </span>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <p className="line-clamp-1 text-xs text-[var(--color-sand-2)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {headerActions && (
            <div onClick={handleActionsClick} className="flex items-center gap-1.5">
              {headerActions}
            </div>
          )}

          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)] text-[var(--color-sand-2)] group-hover:text-[var(--color-foreground)] shadow-xs"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: {
                height: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.2, delay: 0.05 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.15 },
              },
            }}
            className="overflow-hidden"
          >
            <div className={`p-5 ${bodyClassName}`}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
