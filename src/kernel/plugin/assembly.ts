import {
  PluginRegistry,
  type PluginManifest,
  type PluginModule,
} from "./contracts";

export type PluginEntry = {
  manifest: PluginManifest;
  createModule: () => PluginModule;
};

export type PluginHostOptions = {
  allowedCapabilities?: ReadonlySet<string>;
  capabilityPolicy?: Readonly<Record<string, readonly string[]>>;
  eventSink?: (event: string, payload?: unknown) => void;
};

export function createPluginHost(
  entries: PluginEntry[],
  options: PluginHostOptions = {},
): PluginRegistry {
  const registry = new PluginRegistry(options);
  for (const entry of entries) {
    registry.registerEntrySafely(entry.manifest, entry.createModule);
  }
  return registry;
}
