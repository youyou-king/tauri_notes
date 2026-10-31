import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { command, TauriCommandError } from "./client";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("tauri client", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("returns successful command results", async () => {
    vi.mocked(invoke).mockResolvedValue({ ok: true });
    await expect(command("ping")).resolves.toEqual({ ok: true });
  });

  it("classifies permission failures", async () => {
    vi.mocked(invoke).mockRejectedValue("access denied: workspace");
    await expect(command("open")).rejects.toMatchObject({
      name: "TauriCommandError",
      code: "COMMAND_DENIED",
      commandName: "open",
      message: "access denied: workspace",
    } satisfies Partial<TauriCommandError>);
  });

  it("classifies missing commands", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("command not found"));
    await expect(command("missing")).rejects.toMatchObject({
      code: "COMMAND_NOT_FOUND",
    });
  });

  it("classifies other failures", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("disk full"));
    await expect(command("save")).rejects.toMatchObject({
      code: "COMMAND_FAILED",
    });
  });
});
