import { validateContribution } from "./contributionSchema";

export const PLUGIN_SDK_VERSION = 1;

export const CORE_CAPABILITIES = [
  "document.read",
  "document.write",
  "board.read",
  "board.write",
  "appearance.read",
  "appearance.write",
  "reference.read",
  "reference.write",
  "ui.panel",
  "ui.toolbar",
  "ui.settings",
  "ui.command",
  "fs.read",
  "fs.write",
] as const;

export type CoreCapability = (typeof CORE_CAPABILITIES)[number];

const DEFAULT_CAPABILITIES: ReadonlySet<string> = new Set(
  CORE_CAPABILITIES,
);

export type PluginKind = "feature" | "capability" | "data";

export const CONTRIBUTION_KINDS = [
  "commands",
  "panels",
  "overlays",
  "toolbarItems",
  "contextMenuItems",
  "settingsSections",
  "blockTypes",
  "mapNodeTypes",
  "appearancePacks",
  "migrations",
] as const;

export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export type PluginManifest = {
  schema: 1;
  sdkVersion: number;
  id: string;
  name: string;
  version: string;
  kind: PluginKind;
  provides: string[];
  dependencies: string[];
  capabilities: string[];
  contributes?: Partial<Record<ContributionKind, string[]>>;
};

export type PluginContribution = {
  id: string;
  [key: string]: unknown;
};

export type PluginContext = {
  registerContribution: (
    kind: ContributionKind,
    contribution: PluginContribution,
  ) => void;
  emit: (event: string, payload?: unknown) => void;
  hasCapability: (capability: string) => boolean;
};

export type PluginModule = {
  activate: (context: PluginContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
};

export type PluginRegistration = {
  manifest: PluginManifest;
  module: PluginModule;
  contributions?: Array<{ kind: ContributionKind; id: string }>;
};

export type PluginActivationFailure = {
  pluginId: string;
  message: string;
  kind?: "registration" | "activation";
  blockedBy?: string[];
};

const CONTRIBUTION_CAPABILITIES: Partial<
  Record<ContributionKind, string>
> = {
  commands: "ui.command",
  contextMenuItems: "ui.command",
  panels: "ui.panel",
  overlays: "ui.panel",
  toolbarItems: "ui.toolbar",
  settingsSections: "ui.settings",
  appearancePacks: "appearance.read",
  blockTypes: "document.write",
  mapNodeTypes: "document.write",
  migrations: "document.write",
};

const PLUGIN_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const MANIFEST_KEYS = new Set([
  "schema",
  "sdkVersion",
  "id",
  "name",
  "version",
  "kind",
  "provides",
  "dependencies",
  "capabilities",
  "contributes",
]);

export function validatePluginManifest(
  manifest: PluginManifest,
  allowedCapabilities: ReadonlySet<string> = DEFAULT_CAPABILITIES,
): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_KEYS.has(key)) {
      errors.push(`未知字段：${key}`);
    }
  }
  if (manifest.schema !== 1) {
    errors.push("schema 必须为 1");
  }
  if (manifest.sdkVersion !== PLUGIN_SDK_VERSION) {
    errors.push(`sdkVersion 必须为 ${PLUGIN_SDK_VERSION}`);
  }
  if (!PLUGIN_ID.test(manifest.id)) {
    errors.push("id 只能包含小写字母、数字和连字符");
  }
  if (!manifest.name.trim() || manifest.name.length > 60) {
    errors.push("name 必须为 1-60 个字符");
  }
  if (!SEMVER.test(manifest.version)) {
    errors.push("version 必须是语义化版本");
  }
  if (!["feature", "capability", "data"].includes(manifest.kind)) {
    errors.push("kind 必须是 feature、capability 或 data");
  }
  if (!manifest.provides.includes(manifest.id)) {
    errors.push("provides 必须包含自身 id");
  }
  for (const dependency of manifest.dependencies) {
    if (!PLUGIN_ID.test(dependency)) {
      errors.push(`非法依赖：${dependency}`);
    }
  }
  for (const capability of manifest.capabilities) {
    if (!allowedCapabilities.has(capability)) {
      errors.push(`未授权能力：${capability}`);
    }
  }
  if (manifest.contributes) {
    for (const [kind, ids] of Object.entries(manifest.contributes)) {
      if (!(CONTRIBUTION_KINDS as readonly string[]).includes(kind)) {
        errors.push(`未知贡献点：${kind}`);
      }
      if (!Array.isArray(ids)) {
        errors.push(`贡献点 ${kind} 必须是数组`);
      }
    }
  }
  return errors;
}

function resolveOrder(
  entries: Map<string, PluginRegistration>,
): string[] {
  const providedBy = new Map<string, string>();
  for (const [id, registration] of entries) {
    for (const provided of registration.manifest.provides) {
      if (providedBy.has(provided) && providedBy.get(provided) !== id) {
        throw new Error(`能力被重复提供：${provided}`);
      }
      providedBy.set(provided, id);
    }
  }
  providedBy.set("kernel", "kernel");

  const pending = new Map<string, Set<string>>();
  for (const [id, registration] of entries) {
    const dependencies = new Set<string>();
    for (const dependency of registration.manifest.dependencies) {
      const provider = providedBy.get(dependency);
      if (!provider) {
        throw new Error(`缺少依赖：${dependency}`);
      }
      if (provider !== id) {
        dependencies.add(provider);
      }
    }
    pending.set(id, dependencies);
  }

  const order: string[] = [];
  while (pending.size > 0) {
    const ready = [...pending.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([id]) => id)
      .sort();
    if (ready.length === 0) {
      throw new Error("插件依赖存在循环");
    }
    for (const id of ready) {
      pending.delete(id);
      order.push(id);
      for (const dependencies of pending.values()) {
        dependencies.delete(id);
      }
    }
  }
  return order;
}

export class PluginRegistry {
  private readonly registrations = new Map<string, PluginRegistration>();
  private readonly contributions = new Map<
    ContributionKind,
    Map<string, PluginContribution>
  >();
  private readonly active: PluginRegistration[] = [];
  private order: string[] = [];
  private failures = new Map<string, string>();
  private blockedBy = new Map<string, string[]>();
  private registrationFailures = new Map<string, string>();
  private operation: Promise<void> = Promise.resolve();

  constructor(
    private readonly options: {
      allowedCapabilities?: ReadonlySet<string>;
      capabilityPolicy?: Readonly<Record<string, readonly string[]>>;
      eventSink?: (event: string, payload?: unknown) => void;
    } = {},
  ) {}

  register(manifest: PluginManifest, module: PluginModule): void {
    const allowedCapabilities = this.options.capabilityPolicy
      ? new Set(this.options.capabilityPolicy[manifest.id] ?? [])
      : this.options.allowedCapabilities;
    const errors = validatePluginManifest(manifest, allowedCapabilities);
    if (errors.length > 0) {
      throw new Error(`插件 ${manifest.id} 不合法：${errors.join("；")}`);
    }
    if (this.registrations.has(manifest.id)) {
      throw new Error(`插件重复注册：${manifest.id}`);
    }
    this.registrations.set(manifest.id, { manifest, module });
    try {
      this.order = resolveOrder(this.registrations);
    } catch (error) {
      this.registrations.delete(manifest.id);
      throw error;
    }
  }

  /**
   * Registration must not take down the shell. Invalid or unresolved
   * entries become diagnostics instead of render-time exceptions.
   */
  registerSafely(
    manifest: PluginManifest,
    module: PluginModule,
  ): void {
    this.registerEntrySafely(manifest, () => module);
  }

  registerEntrySafely(
    manifest: PluginManifest,
    createModule: () => PluginModule,
  ): void {
    try {
      this.register(manifest, createModule());
    } catch (error) {
      this.registrationFailures.set(
        manifest.id || "unknown",
        String(error),
      );
    }
  }

  start(): Promise<void> {
    return this.enqueue(async () => {
      if (this.active.length > 0) {
        return;
      }
      this.contributions.clear();
      for (const id of this.order) {
        const registration = this.registrations.get(id);
        if (!registration) {
          continue;
        }
        const context = this.createContext(registration);
        try {
          await registration.module.activate(context);
          this.active.push(registration);
        } catch (error) {
          await this.deactivateActive();
          this.contributions.clear();
          throw new Error(`插件 ${id} 激活失败：${String(error)}`);
        }
      }
    });
  }

  startSafely(): Promise<PluginActivationFailure[]> {
    return this.enqueue(async () => {
      if (this.active.length > 0) {
        return this.getFailures();
      }
      this.contributions.clear();
      this.failures.clear();
      this.blockedBy.clear();
      for (const id of this.order) {
        const registration = this.registrations.get(id);
        if (!registration) {
          continue;
        }
        registration.contributions = [];
        const blockedBy = this.unavailableDependencies(registration);
        if (blockedBy.length > 0) {
          this.failures.set(
            id,
            `依赖不可用：${blockedBy.join(", ")}`,
          );
          this.blockedBy.set(id, blockedBy);
          continue;
        }
        try {
          await registration.module.activate(
            this.createContext(registration),
          );
          this.active.push(registration);
        } catch (error) {
          this.removeRegistrationContributions(registration);
          this.failures.set(id, String(error));
          try {
            await registration.module.deactivate?.();
          } catch {
            // Deactivation failure must not mask the activation error.
          }
        }
      }
      return this.getFailures();
    });
  }

  getFailures(): PluginActivationFailure[] {
    const failures = new Map<string, PluginActivationFailure>();
    for (const [pluginId, message] of this.registrationFailures) {
      failures.set(pluginId, {
        pluginId,
        message,
        kind: "registration",
      });
    }
    for (const [pluginId, message] of this.failures) {
      failures.set(pluginId, {
        pluginId,
        message,
        kind: "activation",
        ...(this.blockedBy.has(pluginId)
          ? { blockedBy: this.blockedBy.get(pluginId) }
          : {}),
      });
    }
    return [...failures.values()];
  }

  private unavailableDependencies(
    registration: PluginRegistration,
  ): string[] {
    const providers = new Map<string, string>();
    for (const [id, candidate] of this.registrations) {
      for (const provided of candidate.manifest.provides) {
        providers.set(provided, id);
      }
    }
    const unavailable: string[] = [];
    for (const dependency of registration.manifest.dependencies) {
      const provider = providers.get(dependency);
      if (
        provider &&
        provider !== registration.manifest.id &&
        (this.failures.has(provider) ||
          this.blockedBy.has(provider))
      ) {
        unavailable.push(provider);
      }
    }
    return unavailable;
  }

  stop(): Promise<void> {
    return this.enqueue(async () => {
      await this.deactivateActive();
      this.contributions.clear();
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.operation.then(task, task);
    this.operation = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  getContributions(kind: ContributionKind): PluginContribution[] {
    return [...(this.contributions.get(kind)?.values() ?? [])];
  }

  private removeRegistrationContributions(
    registration: PluginRegistration,
  ): void {
    for (const { kind, id } of registration.contributions ?? []) {
      const bucket = this.contributions.get(kind);
      bucket?.delete(id);
      if (bucket && bucket.size === 0) {
        this.contributions.delete(kind);
      }
    }
    registration.contributions = [];
  }

  private async deactivateActive(): Promise<void> {
    while (this.active.length > 0) {
      const registration = this.active.pop();
      if (registration?.module.deactivate) {
        await registration.module.deactivate();
      }
    }
  }

  private createContext(registration: PluginRegistration): PluginContext {
    return {
      registerContribution: (kind, contribution) => {
        const declared = registration.manifest.contributes?.[kind] ?? [];
        if (!declared.includes(contribution.id)) {
          throw new Error(
            `插件 ${registration.manifest.id} 未声明贡献点 ${kind}:${contribution.id}`,
          );
        }
        const required = CONTRIBUTION_CAPABILITIES[kind];
        if (
          required &&
          !registration.manifest.capabilities.includes(required)
        ) {
          throw new Error(
            `插件 ${registration.manifest.id} 缺少能力 ${required}，无法注册 ${kind}:${contribution.id}`,
          );
        }
        if (kind === "commands" && "capability" in contribution) {
          const capability = contribution.capability;
          if (
            typeof capability === "string" &&
            capability &&
            !registration.manifest.capabilities.includes(capability)
          ) {
            throw new Error(
              `插件 ${registration.manifest.id} 命令 ${contribution.id} 需要能力 ${capability}，但 manifest 未声明`,
            );
          }
        }
        const shapeErrors = validateContribution(kind, contribution);
        if (shapeErrors.length > 0) {
          throw new Error(
            `插件 ${registration.manifest.id} 贡献点 ${kind}:${contribution.id} 不合法：${shapeErrors.join("；")}`,
          );
        }
        const bucket =
          this.contributions.get(kind) ??
          new Map<string, PluginContribution>();
        if (bucket.has(contribution.id)) {
          throw new Error(`贡献点重复：${kind}:${contribution.id}`);
        }
        bucket.set(contribution.id, contribution);
        this.contributions.set(kind, bucket);
        registration.contributions?.push({
          kind,
          id: contribution.id,
        });
      },
      emit: (event, payload) => {
        if (this.options.eventSink) {
          this.options.eventSink(event, payload);
          return;
        }
        window.dispatchEvent(
          new CustomEvent(event, { detail: payload }),
        );
      },
      hasCapability: (capability) =>
        registration.manifest.capabilities.includes(capability),
    };
  }
}
