import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Only the top modal reacts to Escape and Tab. Nested dialogs (settings →
// theme editor) must not close their parent when the child handles a key.
const modalStack: Array<{ token: symbol; layer: number }> = [];
let nextLayer = 1;

export function ModalSurface({
  onClose,
  children,
  className = "app-dialog-backdrop",
  panelClassName,
  ariaLabel,
  ariaLabelledBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
  panelStyle,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  panelStyle?: CSSProperties;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<number | null>(null);
  if (layerRef.current === null) {
    layerRef.current = nextLayer++;
  }
  const layer = layerRef.current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const token = Symbol("modal");
    modalStack.push({ token, layer });
    const isTop = () =>
      layer === Math.max(...modalStack.map((item) => item.layer));
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const autofocus = panel?.querySelector<HTMLElement>("[data-autofocus]");
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (autofocus ?? first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) {
        return;
      }
      if (event.key === "Escape" && closeOnEscape) {
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
      const index = modalStack.findIndex((item) => item.token === token);
      if (index >= 0) {
        modalStack.splice(index, 1);
      }
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [closeOnEscape, layer]);

  return createPortal(
    <div
      className={["app-overlay-backdrop", className].filter(Boolean).join(" ")}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (
          closeOnBackdrop &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        style={panelStyle}
      >
        {children}
      </div>
    </div>,
    document.querySelector<HTMLElement>(".app[data-shell]") ?? document.body,
  );
}
