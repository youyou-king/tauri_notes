import { describe, expect, it, vi } from "vitest";
import {
  PluginRegistry,
  validatePluginManifest,
  type PluginManifest,
  type PluginModule,
} from "./contracts";

function manifest(
  id: string,
  overrides: Partial<PluginManifest> = {},
): PluginManifest {
  return {
    schema: 1,
    sdkVersion: 1,
    id,
    name: id,
    version: "1.0.0",
    kind: "feature",
    provides: [id],
    dependencies: [],
    capabilities: [
      "ui.command",
      "ui.panel",
      "ui.toolbar",
      "ui.settings",
      "appearance.read",
      "document.write",
    ],
    ...overrides,
  };
}

describe("plugin contracts", () => {
  it("rejects unknown fields and unauthorized capabilities", () => {
    const errors = validatePluginManifest(
      {
        ...manifest("board"),
        capabilities: ["fs.write"],
        unknown: true,
      } as PluginManifest,
      new Set(["board.read"]),
    );
    expect(errors).toContain("未知字段：unknown");
    expect(errors).toContain("未授权能力：fs.write");
  });

  it("accepts core capabilities and exposes them to the plugin", async () => {
    const validated = manifest("board", {
      capabilities: ["document.read", "ui.panel"],
    });
    expect(validatePluginManifest(validated)).toEqual([]);

    let granted = false;
    const registry = new PluginRegistry();
    registry.register(validated, {
      activate: (context) => {
        granted = context.hasCapability("document.read");
        expect(context.hasCapability("fs.write")).toBe(false);
      },
    });
    await registry.start();
    expect(granted).toBe(true);
    await registry.stop();
  });

  it("requires capabilities for contribution kinds", async () => {
    const command = { id: "test.run", label: "run" };
    const allowed = new PluginRegistry();
    allowed.register(
      manifest("allowed", {
        capabilities: ["ui.command"],
        contributes: { commands: ["test.run"] },
      }),
      {
        activate: (context) => {
          context.registerContribution("commands", command);
        },
      },
    );
    await allowed.start();
    expect(allowed.getContributions("commands")).toHaveLength(1);
    await allowed.stop();

    const denied = new PluginRegistry();
    denied.register(
      manifest("denied", {
        capabilities: [],
        contributes: { commands: ["test.run"] },
      }),
      {
        activate: (context) => {
          context.registerContribution("commands", command);
        },
      },
    );
    await expect(denied.start()).rejects.toThrow("缺少能力");
  });

  it("requires declared capabilities for commands", async () => {
    const command = {
      id: "test.read",
      label: "Read",
      capability: "document.read",
    };
    const allowed = new PluginRegistry();
    allowed.register(
      manifest("allowed", {
        capabilities: ["ui.command", "document.read"],
        contributes: { commands: ["test.read"] },
      }),
      {
        activate: (context) => {
          context.registerContribution("commands", command);
        },
      },
    );
    await allowed.start();
    await allowed.stop();

    const denied = new PluginRegistry();
    denied.register(
      manifest("denied", {
        capabilities: ["ui.command"],
        contributes: { commands: ["test.read"] },
      }),
      {
        activate: (context) => {
          context.registerContribution("commands", command);
        },
      },
    );
    await expect(denied.start()).rejects.toThrow(
      "需要能力 document.read",
    );
  });

  it("isolates failed plugins from healthy plugins", async () => {
    const registry = new PluginRegistry();
    registry.register(
      manifest("broken", {
        contributes: { commands: ["broken.run"] },
      }),
      {
        activate: () => {
          throw new Error("boom");
        },
      },
    );
    registry.register(
      manifest("healthy", {
        contributes: { commands: ["healthy.run"] },
      }),
      {
        activate: (context) => {
          context.registerContribution("commands", {
            id: "healthy.run",
            label: "Healthy",
          });
        },
      },
    );

    const failures = await registry.startSafely();
    expect(failures).toHaveLength(1);
    expect(failures[0].pluginId).toBe("broken");
    expect(failures[0].message).toContain("boom");
    expect(
      registry
        .getContributions("commands")
        .map((contribution) => contribution.id),
    ).toContain("healthy.run");
    await registry.stop();
  });

  it("requires the current SDK version", () => {
    expect(
      validatePluginManifest(manifest("board", { sdkVersion: 2 })),
    ).toContain("sdkVersion 必须为 1");
  });

  it("activates plugins in dependency order", async () => {
    const registry = new PluginRegistry();
    const order: string[] = [];
    const module = (id: string): PluginModule => ({
      activate: () => {
        order.push(id);
      },
    });
    registry.register(manifest("board"), module("board"));
    registry.register(
      manifest("reference", {
        dependencies: ["board"],
        provides: ["reference"],
      }),
      module("reference"),
    );

    await registry.start();
    expect(order).toEqual(["board", "reference"]);
  });

  it("keeps contributions from every active plugin", async () => {
    const registry = new PluginRegistry();
    registry.register(
      manifest("board", {
        contributes: { commands: ["board.open"] },
      }),
      {
        activate: (context) =>
          context.registerContribution("commands", {
            id: "board.open",
            label: "Open board",
          }),
      },
    );
    registry.register(
      manifest("reference", {
        contributes: { commands: ["reference.resolve"] },
      }),
      {
        activate: (context) =>
          context.registerContribution("commands", {
            id: "reference.resolve",
            label: "Resolve",
          }),
      },
    );

    await registry.start();
    expect(
      registry.getContributions("commands").map((item) => item.id),
    ).toEqual(["board.open", "reference.resolve"]);
    expect(
      registry.getContributionOwner("commands", "board.open"),
    ).toBe("board");
  });

  it("rejects undeclared contributions", async () => {
    const registry = new PluginRegistry();
    registry.register(manifest("board"), {
      activate: (context) =>
        context.registerContribution("commands", { id: "board.open" }),
    });
    await expect(registry.start()).rejects.toThrow("未声明贡献点");
  });

  it("uses the injected event sink instead of window", async () => {
    const received: Array<[string, unknown]> = [];
    const registry = new PluginRegistry({
      eventSink: (event, payload) => received.push([event, payload]),
    });
    registry.register(manifest("board"), {
      activate: (context) => context.emit("board.ready", { ok: true }),
    });

    await registry.start();
    expect(received).toEqual([["board.ready", { ok: true }]]);
  });

  it("does not leak contributions when start and stop overlap", async () => {
    const registry = new PluginRegistry();
    registry.register(
      manifest("board", {
        contributes: { commands: ["board.open"] },
      }),
      {
        activate: async (context) => {
          await Promise.resolve();
          context.registerContribution("commands", {
            id: "board.open",
            label: "Open board",
          });
        },
      },
    );

    const first = registry.start();
    const stopped = registry.stop();
    const second = registry.start();
    await Promise.all([first, stopped, second]);

    expect(
      registry.getContributions("commands").map((item) => item.id),
    ).toEqual(["board.open"]);
  });

  it("deactivates already activated plugins when activation fails", async () => {
    const registry = new PluginRegistry();
    const deactivate = vi.fn();
    registry.register(manifest("board"), {
      activate: () => undefined,
      deactivate,
    });
    registry.register(
      manifest("reference", { dependencies: ["board"] }),
      {
        activate: () => {
          throw new Error("boom");
        },
      },
    );

    await expect(registry.start()).rejects.toThrow("reference 激活失败");
    expect(deactivate).toHaveBeenCalledOnce();
    expect(registry.getContributions("commands")).toEqual([]);
  });
  it("blocks dependents when a dependency fails activation", async () => {
    const registry = new PluginRegistry();
    const activated: string[] = [];
    registry.register(manifest("base"), {
      activate: () => {
        throw new Error("base failed");
      },
    });
    registry.register(
      manifest("child", { dependencies: ["base"] }),
      {
        activate: () => {
          activated.push("child");
        },
      },
    );

    const failures = await registry.startSafely();
    expect(activated).toEqual([]);
    expect(failures).toContainEqual(
      expect.objectContaining({
        pluginId: "child",
        blockedBy: ["base"],
      }),
    );
    await registry.stop();
  });

  it("rejects a failed dependent at the dependency boundary", async () => {
    const registry = new PluginRegistry();
    registry.register(manifest("base"), { activate: () => {} });
    registry.registerEntrySafely(
      manifest("child", { dependencies: ["missing"] }),
      () => ({ activate: () => {} }),
    );
    const failures = await registry.startSafely();
    expect(failures).toContainEqual(
      expect.objectContaining({
        pluginId: "child",
        kind: "registration",
      }),
    );
    await registry.stop();
  });

});
