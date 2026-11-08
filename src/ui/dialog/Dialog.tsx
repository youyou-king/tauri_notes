import { useId, type ReactNode } from "react";
import { IconButton } from "../design-system/Button";
import { Icon } from "../design-system/Icon";
import { ModalSurface } from "./ModalSurface";

type DialogProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
  busy?: boolean;
  className?: string;
  closeOnBackdrop?: boolean;
};

export function Dialog({
  title,
  eyebrow,
  description,
  children,
  footer,
  onClose,
  width = 460,
  busy = false,
  className,
  closeOnBackdrop = true,
}: DialogProps) {
  const titleId = useId();

  return (
    <ModalSurface
      onClose={onClose}
      ariaLabelledBy={titleId}
      panelClassName={["app-dialog", className].filter(Boolean).join(" ")}
      closeOnBackdrop={closeOnBackdrop && !busy}
      closeOnEscape={!busy}
      panelStyle={{ width: `min(${width}px, 100%)` }}
    >
      <header className="app-dialog-header">
        <div>
          {eyebrow && <span className="app-dialog-eyebrow">{eyebrow}</span>}
          <h2 id={titleId}>{title}</h2>
          {description && (
            <p className="app-dialog-description">{description}</p>
          )}
        </div>
        <IconButton
          label="关闭"
          className="app-dialog-close"
          onClick={onClose}
          disabled={busy}
        >
          <Icon name="close" />
        </IconButton>
      </header>
      {children && <div className="app-dialog-body">{children}</div>}
      {footer && <footer className="app-dialog-footer">{footer}</footer>}
    </ModalSurface>
  );
}
