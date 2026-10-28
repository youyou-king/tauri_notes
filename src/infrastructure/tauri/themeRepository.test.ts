import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { themeRepository } from "./themeRepository";

const mockedInvoke = vi.mocked(invoke);

describe("themeRepository", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedInvoke.mockResolvedValue(undefined);
  });

  it("lists theme files", async () => {
    mockedInvoke.mockResolvedValueOnce(['{"id":"ocean"}']);
    const result = await themeRepository.list();
    expect(result).toEqual(['{"id":"ocean"}']);
    expect(mockedInvoke).toHaveBeenCalledWith("list_custom_themes", undefined);
  });

  it("saves theme files through the IPC boundary", async () => {
    await themeRepository.save("ocean", "{}");
    expect(mockedInvoke).toHaveBeenCalledWith("save_custom_theme", {
      id: "ocean",
      json: "{}",
    });
  });

  it("deletes theme files", async () => {
    await themeRepository.delete("ocean");
    expect(mockedInvoke).toHaveBeenCalledWith("delete_custom_theme", {
      id: "ocean",
    });
  });
});
