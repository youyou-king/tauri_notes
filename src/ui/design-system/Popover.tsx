import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useDismissableLayer } from "../primitives/useDismissableLayer";

const MARGIN = 8;
const GAP = 6;

export type PopoverAnchor =
  | { kind: "point"; x: number; y: number }
  | { kind: "element"; element: HTMLElement | null };

export function Popover({
  open,
  anchor,
  onClose,
  children,
  className,
  id,
  ariaLabel,
  role = "menu",
  closeOnViewportChange = false,
  panelRef: externalPanelRef,
  onClick,
  onKeyDown,
  onContextMenu,
}: {
  open: boolean;
  anchor: PopoverAnchor;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  id?: string;
  ariaLabel?: string;
  role?: "menu" | "dialog";
  closeOnViewportChange?: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
}) {
  const internalPanelRef = useRef<HTMLDivElement>(null);
  const panelRef = externalPanelRef ?? internalPanelRef;
  const [placed, setPlaced] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const anchorRef = useRef<HTMLElement | null>(null);
  const anchorElement = anchor.kind === "element" ? anchor.element : null;
  const anchorX = anchor.kind === "point" ? anchor.x : 0;
  const anchorY = anchor.kind === "point" ? anchor.y : 0;

  useLayoutEffect(() => {
    anchorRef.current =
      anchor.kind === "point" ? panelRef.current : anchor.element;
  }, [anchor, open, placed]);

  useLayoutEffect(() => {
    if (!open) {
      setPlaced(false);
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    let left = 0;
    let top = 0;
    if (anchor.kind === "point") {
      left = anchorX;
      top = anchorY;
    } else if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      left = rect.left;
      top = rect.bottom + GAP;
      if (top + height > window.innerHeight - MARGIN && rect.top > height + GAP) {
        top = rect.top - height - GAP;
      }
    }
    left = Math.max(
      MARGIN,
      Math.min(left, window.innerWidth - width - MARGIN),
    );
    top = Math.max(
      MARGIN,
      Math.min(top, window.innerHeight - height - MARGIN),
    );
    setStyle({ left, top });
    setPlaced(true);
  }, [anchor.kind, anchorElement, anchorX, anchorY, open]);

  useDismissableLayer({
    open,
    onClose,
    anchorRef,
    secondaryRef: panelRef,
  });

  useLayoutEffect(() => {
    if (!open || !closeOnViewportChange) {
      return;
    }
    const close = () => onClose();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [closeOnViewportChange, onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      className={["ui-popover", className].filter(Boolean).join(" ")}
      role={role}
      aria-label={ariaLabel}
      data-placed={placed ? "true" : "false"}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      style={{
        ...style,
        position: "fixed",
        visibility: placed ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
