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
  defaults?: KeymapRecord[];
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
function groupRecords(
  records: KeymapRecord[] | undefined,
): Map<string, KeymapRecord[]> {
  const grouped = new Map<string, KeymapRecord[]>();
  for (const record of records ?? []) {
    const bucket = grouped.get(record.action) ?? [];
    bucket.push(record);
    grouped.set(record.action, bucket);
  }
  return grouped;
}

function recordsToBindings(records: KeymapRecord[]): ActionBinding[] {
  return records
    .map(recordToBinding)
    .filter((binding): binding is ActionBinding => binding !== null);
}

/**
 * Applies the TOML-provided defaults and user overrides on top of the action
 * definitions. A TOML profile becomes the source of truth for the actions it
 * covers; actions without a profile entry keep their code fallback.
 */
export function applyKeymap(
  definitions: ActionDefinition[],
  document: KeymapDocument | null,
): ActionDefinition[] {
  if (!document) {
    return definitions;
  }
  const defaultsByAction = groupRecords(document.defaults);
  const userByAction = groupRecords(document.bindings);
  const hasDefaults = defaultsByAction.size > 0;
  if (!hasDefaults && userByAction.size === 0) {
    return definitions;
  }
  return definitions.map((action) => {
    const profileDefaults = defaultsByAction.get(action.id);
    const base = profileDefaults
      ? recordsToBindings(profileDefaults)
      : action.defaultBindings;
    const userRecords = userByAction.get(action.id);
    if (!userRecords || userRecords.length === 0) {
      return base === action.defaultBindings
        ? action
        : { ...action, defaultBindings: base };
    }
    const overriddenPlatforms = new Set(
      userRecords.map((record) => record.platform),
    );
    const retained = base.filter(
      (binding) => !overriddenPlatforms.has(binding.platform),
    );
    return {
      ...action,
      defaultBindings: [...retained, ...recordsToBindings(userRecords)],
    };
  });
}