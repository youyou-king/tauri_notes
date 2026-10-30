import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "../../kernel/plugin";
import { getCommand } from "../../kernel/command";
import { getPanelDefinitions } from "../../kernel/panel";
import { PluginProvider, usePluginHost } from "./PluginProvider";

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
    expect(getCommand("theme.open")?.label).toBe("打开外观设置");
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
