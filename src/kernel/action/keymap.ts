import type {
  ActionBinding,
  ActionDefinition,
  InputPlatform,
} from "./types";

export type KeymapRecord = {
  action: string;
  platform: InputPlatform;
  key?: string;
  code?: string;
  surface?: string;
  scope?: ActionDefinition["scope"];
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
};

export type KeymapDocument = {
  version: number;
  bindings: KeymapRecord[];
};

function recordToBinding(record: KeymapRecord): ActionBinding | null {
  if (record.platform === "mobile") {
    if (!record.surface) {
      return null;
    }
    return {
      kind: "surface",
      platform: "mobile",
      surface: record.surface,
      scope: record.scope ?? "mobile",
    };
  }
  if (!record.key && !record.code) {
    return null;
  }
  return {
    kind: "key",
    platform: record.platform,
    key: record.key ?? "",
    code: record.code,
    scope: record.scope ?? "global",
    ctrl: record.ctrl,
    meta: record.meta,
    alt: record.alt,
    shift: record.shift,
  };
}

/**
 * Applies user keymap records on top of action defaults. User records replace
 * defaults for the same platform, so a platform can be remapped without
 * touching the other platforms' defaults.
 */
export function applyKeymap(
  definitions: ActionDefinition[],
  document: KeymapDocument | null,
): ActionDefinition[] {
  if (!document || document.bindings.length === 0) {
    return definitions;
  }
  const byAction = new Map<string, KeymapRecord[]>();
  for (const record of document.bindings) {
    const bucket = byAction.get(record.action) ?? [];
    bucket.push(record);
    byAction.set(record.action, bucket);
  }
  return definitions.map((action) => {
    const records = byAction.get(action.id);
    if (!records || records.length === 0) {
      return action;
    }
    const overriddenPlatforms = new Set(records.map((record) => record.platform));
    const defaults = action.defaultBindings.filter(
      (binding) => !overriddenPlatforms.has(binding.platform),
    );
    const bindings = records
      .map(recordToBinding)
      .filter((binding): binding is ActionBinding => binding !== null);
    return {
      ...action,
      defaultBindings: [...defaults, ...bindings],
    };
  });
}