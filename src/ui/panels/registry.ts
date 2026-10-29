import { createElement, type ComponentType } from "react";
import { PanelErrorBoundary } from "../ErrorBoundary";

/**
 * Registered dock panels. Components stay independent of the registry; the
 * registry only owns identity, icon, and default title metadata.
 */
export type PanelDefinition = {
  id: string;
  component: ComponentType<any>;
  icon: string;
  defaultTitle: string;
  singleton?: boolean;
};

const definitions = new Map<string, PanelDefinition>();

export function registerPanel(definition: PanelDefinition): void {
  definitions.set(definition.id, definition);
}

export function getPanelComponents(): Record<string, ComponentType<any>> {
  return Object.fromEntries(
    [...definitions.values()].map((definition) => {
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

export function getPanelIcon(component: string): string {
  return definitions.get(component)?.icon ?? "▦";
}

export function getPanelDefaultTitle(component: string): string {
  return definitions.get(component)?.defaultTitle ?? component;
}
