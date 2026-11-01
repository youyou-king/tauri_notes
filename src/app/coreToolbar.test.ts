import { describe, expect, it } from "vitest";
import { getAction } from "../kernel/action";
import { getCommand } from "../kernel/command";
import "./navCommands";
import "./actions";
import { CORE_TOOLBAR_ITEMS } from "./coreToolbar";

describe("core toolbar", () => {
  it("owns the settings entry instead of a feature plugin", () => {
    const settings = CORE_TOOLBAR_ITEMS.find(
      (item) => item.id === "settings.open",
    );
    expect(settings).toMatchObject({
      id: "settings.open",
      commandId: "settings.open",
      order: 90,
    });
    expect(settings?.menu).toBeUndefined();
    expect(getCommand("settings.open")).toBeDefined();
    expect(getAction("settings.open")?.defaultBindings.length).toBeGreaterThan(0);
  });
});
