import type { ComponentType } from "react";

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
    [...definitions.values()].map((definition) => [
      definition.id,
      definition.component,
    ]),
  );
}

export function getPanelIcon(component: string): string {
  return definitions.get(component)?.icon ?? "▦";
}

export function getPanelDefaultTitle(component: string): string {
  return definitions.get(component)?.defaultTitle ?? component;
}
