import { useRef, useState, type PointerEvent } from "react";
import type { MobileViewKind } from "../../application/stores/mobileShellStore";

export type MobileDragPoint = { x: number; y: number };

const ITEMS: Array<{ kind: MobileViewKind; label: string }> = [
  { kind: "map", label: "导图" },
  { kind: "outline", label: "大纲" },
  { kind: "document", label: "文档" },
];

export function MobileDock({
  view,
  hasDocument,
  presentKinds,
  onSelect,
  onDragMove,
  onDrop,
  onDragCancel,
}: {
  view: MobileViewKind;
  hasDocument: boolean;
  presentKinds: MobileViewKind[];
  onSelect: (kind: MobileViewKind) => void;
  onDragMove: (kind: MobileViewKind, point: MobileDragPoint) => void;
  onDrop: (kind: MobileViewKind, point: MobileDragPoint) => void;
  onDragCancel: () => void;
}) {
  const drag = useRef<{
    kind: MobileViewKind;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    active: boolean;
  } | null>(null);
  const suppressClick = useRef<MobileViewKind | null>(null);
  const [dragging, setDragging] = useState<MobileViewKind | null>(null);

  const reset = () => {
    drag.current = null;
    setDragging(null);
  };

  const beginDrag = (kind: MobileViewKind, x: number, y: number) => {
    drag.current = {
      kind,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      active: false,
    };
    setDragging(null);
  };

  const moveDrag = (kind: MobileViewKind, x: number, y: number) => {
    const current = drag.current;
    if (!current || current.kind !== kind) {
      return;
    }
    current.lastX = x;
    current.lastY = y;
    if (
      !current.active &&
      Math.hypot(x - current.startX, y - current.startY) > 8
    ) {
      current.active = true;
      setDragging(kind);
    }
    if (current.active) {
      onDragMove(kind, { x, y });
    }
  };

  const endDrag = (kind: MobileViewKind) => {
    const current = drag.current;
    if (!current || current.kind !== kind) {
      reset();
      return;
    }
    const wasActive = current.active;
    const point = { x: current.lastX, y: current.lastY };
    reset();
    if (!wasActive) {
      return;
    }
    suppressClick.current = kind;
    window.setTimeout(() => {
      if (suppressClick.current === kind) {
        suppressClick.current = null;
      }
    }, 350);
    onDrop(kind, point);
  };

  const cancelDrag = () => {
    const wasActive = drag.current?.active;
    reset();
    if (wasActive) {
      onDragCancel();
    }
  };

  const handlePointerDown = (
    kind: MobileViewKind,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    beginDrag(kind, event.clientX, event.clientY);
  };

  const handlePointerUp = (
    kind: MobileViewKind,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    endDrag(kind);
  };

  return (
    <nav className="mobile-dock" aria-label="工作区视图">
      {ITEMS.map((item) => {
        const disabled = item.kind === "document" && !hasDocument;
        return (
          <button
            key={item.kind}
            type="button"
            className={[
              "mobile-nav-item",
              view === item.kind ? "active" : "",
              presentKinds.includes(item.kind) ? "present" : "",
              dragging === item.kind ? "dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={view === item.kind ? "page" : undefined}
            aria-label={item.label}
            title="拖动可停靠到分屏区域"
            disabled={disabled}
            onPointerDown={(event) => handlePointerDown(item.kind, event)}
            onPointerMove={(event) => {
              moveDrag(item.kind, event.clientX, event.clientY);
            }}
            onPointerUp={(event) => handlePointerUp(item.kind, event)}
            onPointerCancel={cancelDrag}
            onMouseDown={(event) => {
              if (event.button === 0) {
                beginDrag(item.kind, event.clientX, event.clientY);
              }
            }}
            onMouseMove={(event) =>
              moveDrag(item.kind, event.clientX, event.clientY)
            }
            onMouseUp={() => endDrag(item.kind)}
            onMouseLeave={() => {
              if (!drag.current?.active) {
                reset();
              }
            }}
            onClick={() => {
              if (suppressClick.current === item.kind) {
                suppressClick.current = null;
                return;
              }
              onSelect(item.kind);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}