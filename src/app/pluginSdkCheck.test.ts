import { describe, expect, it } from "vitest";
import { sdkMismatchMessage } from "./pluginSdkCheck";

describe("plugin SDK version check", () => {
  it("accepts matching versions", () => {
    expect(sdkMismatchMessage(1)).toBeNull();
  });

  it("reports a mismatch with both versions", () => {
    const message = sdkMismatchMessage(2);
    expect(message).toContain("前端 1");
    expect(message).toContain("后端 2");
  });
});
