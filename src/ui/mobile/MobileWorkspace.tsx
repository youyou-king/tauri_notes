import {
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import type {
  MobilePane,
  MobileView,
} from "../../application/stores/mobileShellStore";
import { IconButton } from "../design-system/Button";
import { Icon } from "../design-system/Icon";
import {
  clampSplitRatio,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  type MobileSplitAxis,
  type MobileSplitRatios,
} from "../../application/stores/mobileLayout";

export function MobileWorkspace({
  views,
  focused,
  ratios,
  axis,
  onFocus,
  onRatio,
  onCloseSplit,
  renderView,
  labelFor,
}: {
  views: [MobileView, MobileView | null];
  focused: MobilePane;
  ratios: MobileSplitRatios;
  axis: MobileSplitAxis;
  onFocus: (pane: MobilePane) => void;
  onRatio: (axis: MobileSplitAxis, ratio: number) => void;
  onCloseSplit: () => void;
  renderView: (view: MobileView) => ReactNode;
  labelFor: (view: MobileView) => string;
}) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number } | null>(null);
  const primary = views[0];
  const secondary = views[1];
  const horizontal = axis === "row";
  const ratio = ratios[axis];

  const updateFromPointer = (clientX: number, clientY: number) => {
    const element = workspaceRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const length = (horizontal ? rect.width : rect.height) - 34;
    if (length <= 0) {
      return;
    }
    const position = horizontal
      ? clientX - rect.left - 17
      : clientY - rect.top - 17;
    onRatio(axis, clampSplitRatio(position / length));
  };

  const onDividerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId };
    event.preventDefault();
  };

  const onDividerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    updateFromPointer(event.clientX, event.clientY);
  };

  const onDividerPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      dragRef.current = null;
    }
  };

  const style = {
    "--mobile-split-ratio": ratio,
  } as CSSProperties;
  const split = Boolean(secondary);

  return (
    <div
      ref={workspaceRef}
      className={[
        "mobile-workspace",
        split ? "is-split" : "",
        split && horizontal ? "is-horizontal" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <section
        className={`mobile-pane mobile-pane-${primary.kind}${
          split && focused === 0 ? " is-focused" : ""
        }`}
        aria-label={labelFor(primary)}
        onPointerDown={() => onFocus(0)}
      >
        {renderView(primary)}
      </section>
      {secondary && (
        <>
          <div
            className={`mobile-split-divider${
              horizontal ? " is-horizontal" : ""
            }`}
            role="separator"
            aria-orientation={horizontal ? "vertical" : "horizontal"}
            aria-label="调整分屏比例"
            aria-valuemin={MIN_SPLIT_RATIO}
            aria-valuemax={MAX_SPLIT_RATIO}
            aria-valuenow={Math.round(ratio * 100)}
            title="拖动调整分屏比例"
            onPointerDown={onDividerPointerDown}
            onPointerMove={onDividerPointerMove}
            onPointerUp={onDividerPointerUp}
            onPointerCancel={onDividerPointerUp}
            tabIndex={0}
            onKeyDown={(event) => {
              const step = 0.05;
              if (
                event.key === "ArrowUp" ||
                event.key === "ArrowLeft"
              ) {
                event.preventDefault();
                onRatio(axis, clampSplitRatio(ratio - step));
              } else if (
                event.key === "ArrowDown" ||
                event.key === "ArrowRight"
              ) {
                event.preventDefault();
                onRatio(axis, clampSplitRatio(ratio + step));
              }
            }}
          >
            <span className="mobile-split-grip" aria-hidden="true" />
            <IconButton
              label="退出分屏"
              className="mobile-split-close"
              onClick={onCloseSplit}
            >
              <Icon name="close" size={13} />
            </IconButton>
          </div>
          <section
            className={`mobile-pane mobile-pane-${secondary.kind} mobile-pane-secondary${
              focused === 1 ? " is-focused" : ""
            }`}
            aria-label={labelFor(secondary)}
            onPointerDown={() => onFocus(1)}
          >
            {renderView(secondary)}
          </section>
        </>
      )}
    </div>
  );
}