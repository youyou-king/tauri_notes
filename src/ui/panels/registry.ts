import { createElement, type ComponentType } from "react";
import { PanelErrorBoundary } from "../ErrorBoundary";
import { getPanelDefinitions } from "../../kernel/panel/registry";

export type { PanelDefinition } from "../../kernel/panel/registry";
export {
  getPanelDefaultTitle,
  getPanelIcon,
  registerPanel,
} from "../../kernel/panel/registry";

/**
 * UI adapter: the kernel owns panel identity; the shell adds the error
 * boundary because it is a React concern.
 */
export function getPanelComponents(): Record<string, ComponentType<any>> {
  return Object.fromEntries(
    getPanelDefinitions().map((definition) => {
      const Inner = definition.component;
      const Bounded = (props: Record<string, unknown>) =>
        createElement(
          PanelErrorBoundary,
          { panelId: definition.id },
          createElement(Inner, props),
        );
      Bounded.displayName = `PanelBoundary(${definition.id})`;
      return [definition.id, Bounded];
    }),
  );
}
