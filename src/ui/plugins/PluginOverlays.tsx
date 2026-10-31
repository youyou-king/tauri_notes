import { Suspense, type ComponentType } from "react";
import { getUiRenderer } from "../../kernel/ui";
import type { OverlayContribution } from "../../kernel/plugin";
import { ErrorBoundary } from "../ErrorBoundary";
import { usePluginContributions } from "./pluginContext";

export function PluginOverlays() {
  const overlays =
    usePluginContributions<OverlayContribution>("overlays");
  return (
    <>
      {overlays.map((overlay) => {
        const Component = getUiRenderer(overlay.renderer) as
          | ComponentType
          | undefined;
        if (!Component) {
          return null;
        }
        return (
          <ErrorBoundary
            key={overlay.id}
            compact
            title={`覆盖层加载失败：${overlay.id}`}
          >
            <Suspense fallback={null}>
              <Component />
            </Suspense>
          </ErrorBoundary>
        );
      })}
    </>
  );
}
