export type MobileViewKind = "map" | "outline" | "document";

export type MobileView = {
  kind: MobileViewKind;
  documentId: string | null;
};

export type MobilePane = 0 | 1;

/** The main-axis direction used by the split layout. */
export type MobileSplitAxis = "column" | "row";

export type MobileDropPlacement =
  | "left"
  | "right"
  | "above"
  | "below"
  | "center";

export type MobileSplitRatios = {
  column: number;
  row: number;
};

export type MobileLayout = {
  views: [MobileView, MobileView | null];
  focused: MobilePane;
  ratios: MobileSplitRatios;
  axis: MobileSplitAxis;
};

export const DEFAULT_SPLIT_RATIO = 0.5;
export const MIN_SPLIT_RATIO = 0.25;
export const MAX_SPLIT_RATIO = 0.75;

export const DEFAULT_SPLIT_RATIOS: MobileSplitRatios = {
  column: DEFAULT_SPLIT_RATIO,
  row: DEFAULT_SPLIT_RATIO,
};

export const DEFAULT_SPLIT_AXIS: MobileSplitAxis = "column";

export function axisForPlacement(
  placement: MobileDropPlacement,
): MobileSplitAxis | null {
  if (placement === "left" || placement === "right") {
    return "row";
  }
  if (placement === "above" || placement === "below") {
    return "column";
  }
  return null;
}

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SPLIT_RATIO;
  }
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
}

export function normalizeSplitRatios(value: unknown): MobileSplitRatios {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SPLIT_RATIOS };
  }
  const candidate = value as Partial<MobileSplitRatios>;
  return {
    column:
      typeof candidate.column === "number"
        ? clampSplitRatio(candidate.column)
        : DEFAULT_SPLIT_RATIO,
    row:
      typeof candidate.row === "number"
        ? clampSplitRatio(candidate.row)
        : DEFAULT_SPLIT_RATIO,
  };
}

export const MAP_VIEW: MobileView = { kind: "map", documentId: null };
export const OUTLINE_VIEW: MobileView = { kind: "outline", documentId: null };

export function documentView(documentId: string): MobileView {
  return { kind: "document", documentId };
}

export function viewKey(view: MobileView): string {
  return `${view.kind}:${view.documentId ?? ""}`;
}

export function sameView(left: MobileView, right: MobileView): boolean {
  return viewKey(left) === viewKey(right);
}

export function viewForKind(
  layout: MobileLayout,
  kind: MobileViewKind,
  fallbackDocumentId: string | null = null,
): MobileView | null {
  if (kind === "document") {
    return (
      layout.views.find((view) => view?.kind === "document") ??
      (fallbackDocumentId ? documentView(fallbackDocumentId) : null)
    );
  }
  return kind === "map" ? MAP_VIEW : OUTLINE_VIEW;
}

export function focusedView(layout: MobileLayout): MobileView {
  return layout.views[layout.focused] ?? layout.views[0];
}

export function closeSplit(layout: MobileLayout): MobileLayout {
  return {
    views: [layout.views[0], null],
    focused: 0,
    ratios: layout.ratios,
    axis: layout.axis,
  };
}

/**
 * Replaces the focused pane. A view kind is a singleton: if the other pane
 * already owns that view, focus it instead of creating a duplicate.
 */
export function replaceFocused(
  layout: MobileLayout,
  view: MobileView,
): MobileLayout {
  const otherIndex: MobilePane = layout.focused === 0 ? 1 : 0;
  const other = layout.views[otherIndex];

  if (other && other.kind === view.kind) {
    if (view.kind !== "document" || sameView(other, view)) {
      return { ...layout, focused: otherIndex };
    }
    const views: [MobileView, MobileView | null] = [...layout.views];
    views[otherIndex] = view;
    return {
      views,
      focused: otherIndex,
      ratios: layout.ratios,
      axis: layout.axis,
    };
  }

  const views: [MobileView, MobileView | null] = [...layout.views];
  views[layout.focused] = view;
  return {
    views,
    focused: layout.focused,
    ratios: layout.ratios,
    axis: layout.axis,
  };
}

/**
 * Applies a dropped view to a dock-like zone: center replaces/focuses a pane,
 * edges split on the matching axis. Existing singleton views are focused.
 */
export function dockView(
  layout: MobileLayout,
  view: MobileView,
  placement: MobileDropPlacement,
): MobileLayout {
  const axis = axisForPlacement(placement) ?? layout.axis;
  for (const index of [0, 1] as const) {
    const existing = layout.views[index];
    if (existing && sameView(existing, view)) {
      const other = layout.views[index === 0 ? 1 : 0];
      const before = placement === "left" || placement === "above";
      if (
        !other ||
        placement === "center" ||
        (index === 0 && before) ||
        (index === 1 && !before)
      ) {
        return { ...layout, focused: index, axis };
      }
      return {
        views: before ? [view, other] : [other, view],
        focused: before ? 0 : 1,
        ratios: layout.ratios,
        axis,
      };
    }
  }

  if (placement === "center") {
    return { ...replaceFocused(layout, view), axis: layout.axis };
  }

  const primary = layout.views[0];
  const before = placement === "left" || placement === "above";
  return {
    views: before ? [view, primary] : [primary, view],
    focused: before ? 0 : 1,
    ratios: layout.ratios,
    axis,
  };
}

export function resolveDropPlacement(
  point: { x: number; y: number },
  viewport: { width: number; height: number },
): MobileDropPlacement {
  const horizontal = point.x / Math.max(viewport.width, 1);
  const vertical = point.y / Math.max(viewport.height, 1);
  if (horizontal < 0.25) {
    return "left";
  }
  if (horizontal > 0.75) {
    return "right";
  }
  if (vertical < 0.25) {
    return "above";
  }
  if (vertical > 0.75) {
    return "below";
  }
  return "center";
}

export function focusPane(
  layout: MobileLayout,
  pane: MobilePane,
): MobileLayout {
  if (!layout.views[pane]) {
    return layout;
  }
  return { ...layout, focused: pane };
}

export function isLayoutValid(views: unknown): views is MobileLayout["views"] {
  if (!Array.isArray(views) || views.length !== 2) {
    return false;
  }
  const [primary, secondary] = views;
  if (!isView(primary) || (secondary !== null && !isView(secondary))) {
    return false;
  }
  if (secondary && primary.kind === secondary.kind) {
    return false;
  }
  if (
    primary.kind === "document" &&
    (!primary.documentId || secondary?.documentId === primary.documentId)
  ) {
    return false;
  }
  return true;
}

export function isView(value: unknown): value is MobileView {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<MobileView>;
  if (
    candidate.kind !== "map" &&
    candidate.kind !== "outline" &&
    candidate.kind !== "document"
  ) {
    return false;
  }
  return (
    candidate.kind === "document"
      ? typeof candidate.documentId === "string" &&
        candidate.documentId.length > 0
      : candidate.documentId === null
  );
}