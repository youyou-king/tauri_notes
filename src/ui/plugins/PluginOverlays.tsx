import { Suspense, type ComponentType } from "react";
import { getUiRenderer } from "../../kernel/ui";
import type { OverlayContribution } from "../../kernel/plugin";
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
          <Suspense key={overlay.id} fallback={null}>
            <Component />
          </Suspense>
        );
      })}
    </>
  );
}
