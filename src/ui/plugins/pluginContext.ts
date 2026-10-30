import { createContext, useContext } from "react";
import type {
  ContributionKind,
  PluginActivationFailure,
  PluginContribution,
  PluginEntry,
  PluginRegistry,
} from "../../kernel/plugin";

export type PluginHostContextValue = {
  host: PluginRegistry;
  revision: number;
  entries: PluginEntry[];
  failures: PluginActivationFailure[];
};

export const PluginHostContext =
  createContext<PluginHostContextValue | null>(null);

export function usePluginHost(): PluginRegistry {
  const value = useContext(PluginHostContext);
  if (!value) {
    throw new Error("usePluginHost must be used inside PluginProvider");
  }
  return value.host;
}

export function usePluginEntries(): PluginEntry[] {
  const value = useContext(PluginHostContext);
  return value?.entries ?? [];
}

export function usePluginFailures(): PluginActivationFailure[] {
  return useContext(PluginHostContext)?.failures ?? [];
}

export function usePluginReady(): boolean {
  const value = useContext(PluginHostContext);
  return Boolean(value && value.revision > 0);
}

export function usePluginContributions<T extends PluginContribution>(
  kind: ContributionKind,
): T[] {
  const value = useContext(PluginHostContext);
  if (!value) {
    throw new Error(
      "usePluginContributions must be used inside PluginProvider",
    );
  }
  void value.revision;
  return value.host.getContributions(kind) as T[];
}
