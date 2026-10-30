import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./timeout";

describe("command timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves before the deadline", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, "cmd")).resolves.toBe(
      7,
    );
  });

  it("rejects when the deadline passes", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 1000, "插件命令");
    const assertion = expect(pending).rejects.toThrow("执行超时");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
