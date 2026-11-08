import { describe, expect, it } from "vitest";
import { findBindingConflicts, getAction, listActions } from "../../../src/kernel/action";
import "../../../src/app/actions";

describe("application actions", () => {
  it("registers the shell bindings without collisions", () => {
    expect(listActions().length).toBeGreaterThanOrEqual(13);
    expect(findBindingConflicts()).toEqual([]);
    expect(getAction("settings.open")?.defaultBindings).not.toHaveLength(0);
    expect(getAction("search.open")?.defaultBindings).not.toHaveLength(0);
    expect(getAction("help.open")?.defaultBindings).not.toHaveLength(0);
  });
});