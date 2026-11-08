import type { ReactNode } from "react";
import { IconButton } from "./Button";

export function SurfaceHeader({
  className,
  eyebrow,
  title,
  subtitle,
  titleAs = "strong",
  actions,
  onClose,
  closeLabel = "关闭",
  closeClassName,
}: {
  className: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  titleAs?: "strong" | "h2";
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  closeClassName?: string;
}) {
  return (
    <header className={className}>
      <div className="ui-surface-header-copy">
        {eyebrow && <span className="ui-surface-header-eyebrow">{eyebrow}</span>}
        {titleAs === "h2" ? <h2>{title}</h2> : <strong>{title}</strong>}
        {subtitle && <span>{subtitle}</span>}
      </div>
      {actions}
      {onClose && (
        <IconButton
          label={closeLabel}
          className={closeClassName}
          onClick={onClose}
        >
          ×
        </IconButton>
      )}
    </header>
  );
}
