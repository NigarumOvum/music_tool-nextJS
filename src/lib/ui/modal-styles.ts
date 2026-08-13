export const modalClassNames = {
  backdrop: "modal-backdrop-solid",
  base: "modal-solid max-h-[90vh]",
  header: "border-b border-[var(--color-border)]",
  footer: "border-t border-[var(--color-border)]",
  body: "py-5",
  closeButton: "hover:bg-[var(--color-surface-soft)]",
} as const;

export const opaqueModalProps = {
  backdrop: "opaque" as const,
  classNames: modalClassNames,
};
