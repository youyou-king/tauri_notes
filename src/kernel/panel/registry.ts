import type { ComponentType } from "react";

export type PanelDefinition = {
  id: string;
  component: ComponentType<any>;
  icon: string;
  defaultTitle: string;
  singleton?: boolean;
};

const definitions = new Map<string, PanelDefinition>();

export function registerPanel(definition: PanelDefinition): void {
  // Panels are registered at module scope. Replacing makes the registry safe
  // for Vite HMR, which can re-evaluate a module and register the same id.
  definitions.set(definition.id, definition);
}

export function unregisterPanel(id: string): void {
  definitions.delete(id);
}

export function getPanelDefinitions(): PanelDefinition[] {
  return [...definitions.values()];
}

export function getPanelIcon(component: string): string {
  return definitions.get(component)?.icon ?? "▦";
}

export function getPanelDefaultTitle(component: string): string {
  return definitions.get(component)?.defaultTitle ?? component;
}
