import type { ComponentType } from "react";

/**
 * Known shell renderers and their prop contracts. Plugins may still register
 * additional ids at runtime, but built-in shell/feature boundaries are typed.
 */
export type UiRendererProps = {
  "document.importedView": {
    workspaceRoot: string;
    documentId?: string;
    panelId?: string;
  };
  "search.overlay": Record<string, never>;
};

const renderers = new Map<string, ComponentType<Record<string, unknown>>>();

export function registerUiRenderer<K extends keyof UiRendererProps>(
  id: K,
  renderer: ComponentType<UiRendererProps[K]>,
): void;
export function registerUiRenderer(
  id: string,
  renderer: ComponentType<Record<string, unknown>>,
): void;
export function registerUiRenderer(
  id: string,
  renderer: ComponentType<Record<string, unknown>>,
): void {
  renderers.set(id, renderer);
}

export function unregisterUiRenderer(id: string): void {
  renderers.delete(id);
}

export function getUiRenderer<K extends keyof UiRendererProps>(
  id: K,
): ComponentType<UiRendererProps[K]> | null;
export function getUiRenderer(
  id: string,
): ComponentType<Record<string, unknown>> | null;
export function getUiRenderer(
  id: string,
): ComponentType<Record<string, unknown>> | null {
  return renderers.get(id) ?? null;
}

export function hasUiRenderer(id: string): boolean {
  return renderers.has(id);
}
