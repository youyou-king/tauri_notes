import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "../../../../src/kernel/plugin";
import { getCommand } from "../../../../src/kernel/command";
import { getPanelDefinitions } from "../../../../src/kernel/panel";
import { PluginProvider, usePluginHost } from "../../../../src/ui/plugins/PluginProvider";

describe("PluginProvider", () => {
  it("activates the default theme plugin", async () => {
    const ref: { current: PluginRegistry | null } = { current: null };
    function Probe() {
      ref.current = usePluginHost();
      return null;
    }

    render(
      <PluginProvider>
        <Probe />
      </PluginProvider>,
    );

    await waitFor(() => {
      expect(ref.current?.getContributions("commands")).toHaveLength(7);
    });
    expect(ref.current?.getContributions("appearancePacks")[0]?.id).toBe(
      "theme.builtin",
    );
    expect(getCommand("theme.open")?.label).toBe("外观");
    expect(ref.current?.getContributions("commands").map((item) => item.id)).toContain(
      "search.open",
    );
    expect(ref.current?.getContributions("commands").map((item) => item.id)).toContain(
      "help.open",
    );
    expect(ref.current?.getContributions("commands").map((item) => item.id)).toContain(
      "viewport.pick",
    );
    expect(ref.current?.getContributions("commands").map((item) => item.id)).toContain(
      "reference.resolve",
    );
    expect(ref.current?.getContributions("panels")[0]?.id).toBe(
      "board",
    );
    expect(
      getPanelDefinitions().some((panel) => panel.id === "board"),
    ).toBe(true);
  });
});
