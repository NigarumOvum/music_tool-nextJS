"use client";

import { Info } from "lucide-react";
import { Tooltip } from "@heroui/react";

export type InfoTooltipProps = {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function InfoTooltip({
  content,
  position = "top",
  size = "md",
  className = "",
}: InfoTooltipProps) {
  const sizeClasses = {
    sm: "max-w-xs",
    md: "max-w-md",
    lg: "max-w-lg",
  };

  return (
    <Tooltip
      content={
        <div className={`p-3 text-sm leading-relaxed ${sizeClasses[size]}`}>
          {content}
        </div>
      }
      placement={position}
      showArrow
      className="bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-[var(--color-foreground)]"
    >
      <button
        type="button"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-sand-2)] transition hover:border-[var(--color-brass)] hover:text-[var(--color-brass)] ${className}`}
        aria-label="Show info"
      >
        <Info className="h-3 w-3" />
      </button>
    </Tooltip>
  );
}