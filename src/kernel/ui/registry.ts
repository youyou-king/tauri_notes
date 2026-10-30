import type { ComponentType } from "react";

/**
 * Shell and feature UI meet here. The shell resolves a renderer by id and
 * features register implementations during activation, so neither side needs
 * to import the other's UI module.
 */
const renderers = new Map<string, ComponentType<Record<string, unknown>>>();

export function registerUiRenderer(
  id: string,
  renderer: ComponentType<Record<string, unknown>>,
): void {
  renderers.set(id, renderer);
}

export function unregisterUiRenderer(id: string): void {
  renderers.delete(id);
}

export function getUiRenderer(
  id: string,
): ComponentType<Record<string, unknown>> | null {
  return renderers.get(id) ?? null;
}

export function hasUiRenderer(id: string): boolean {
  return renderers.has(id);
}
