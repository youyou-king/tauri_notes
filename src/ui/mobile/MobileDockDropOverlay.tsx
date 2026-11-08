import type { MobileDropPlacement } from "../../application/stores/mobileLayout";
import type { MobileDragPoint } from "./MobileDock";

const ZONES: Array<{
  placement: MobileDropPlacement;
  label: string;
  className: string;
}> = [
  { placement: "left", label: "左侧分屏", className: "left" },
  { placement: "right", label: "右侧分屏", className: "right" },
  { placement: "above", label: "上方分屏", className: "above" },
  { placement: "below", label: "下方分屏", className: "below" },
  { placement: "center", label: "合并到窗格", className: "center" },
];

export function MobileDockDropOverlay({
  active,
  label,
  point,
  placement,
}: {
  active: boolean;
  label: string;
  point: MobileDragPoint | null;
  placement: MobileDropPlacement | null;
}) {
  if (!active) {
    return null;
  }
  return (
    <div className="mobile-dock-drop-overlay" aria-hidden="true">
      {ZONES.map((zone) => (
        <div
          key={zone.placement}
          className={`mobile-drop-zone mobile-drop-${zone.className}${
            placement === zone.placement ? " is-active" : ""
          }`}
        >
          <span>{zone.label}</span>
        </div>
      ))}
      {point && (
        <div
          className="mobile-drop-ghost"
          style={{ left: point.x, top: point.y }}
        >
          {label}
        </div>
      )}
    </div>
  );
}