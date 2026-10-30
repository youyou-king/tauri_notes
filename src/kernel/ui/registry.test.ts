import { describe, expect, it } from "vitest";
import {
  getUiRenderer,
  hasUiRenderer,
  registerUiRenderer,
  unregisterUiRenderer,
} from "./registry";

const Renderer = () => null;

describe("UI renderer registry", () => {
  it("registers, resolves and removes renderers", () => {
    registerUiRenderer("test.renderer", Renderer);
    expect(hasUiRenderer("test.renderer")).toBe(true);
    expect(getUiRenderer("test.renderer")).toBe(Renderer);

    unregisterUiRenderer("test.renderer");
    expect(hasUiRenderer("test.renderer")).toBe(false);
    expect(getUiRenderer("test.renderer")).toBeNull();
  });
});
