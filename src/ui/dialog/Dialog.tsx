import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

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

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<() => void>(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const autofocus = panel?.querySelector<HTMLElement>("[data-autofocus]");
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (autofocus ?? first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) {
        return;
      }
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [busy]);

  return createPortal(
    <div
      className="app-dialog-backdrop"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (
          closeOnBackdrop &&
          !busy &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={["app-dialog", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width: `min(${width}px, 100%)` }}
      >
        <header className="app-dialog-header">
          <div>
            {eyebrow && <span className="app-dialog-eyebrow">{eyebrow}</span>}
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p className="app-dialog-description">{description}</p>
            )}
          </div>
          <button
            type="button"
            className="app-dialog-close"
            aria-label="关闭"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>
        {children && <div className="app-dialog-body">{children}</div>}
        {footer && <footer className="app-dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
