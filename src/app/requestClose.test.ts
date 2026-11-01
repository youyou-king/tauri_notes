import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDialog } from "../ui/dialog/confirmDialog";
import { requestClose } from "./requestClose";

vi.mock("../ui/dialog/confirmDialog", () => ({
  confirmDialog: vi.fn(),
}));

const confirm = vi.mocked(confirmDialog);

beforeEach(() => {
  confirm.mockReset();
});

describe("requestClose", () => {
  it("closes without confirmation when nothing is dirty", async () => {
    await expect(
      requestClose({ kind: "window", dirtyCount: 0 }),
    ).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("uses the workspace message and count", async () => {
    confirm.mockResolvedValue(false);
    await expect(
      requestClose({ kind: "workspace", dirtyCount: 3 }),
    ).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "放弃未保存的修改？",
        message: expect.stringContaining("3 个面板"),
        tone: "danger",
      }),
    );
  });

  it("uses the window message", async () => {
    confirm.mockResolvedValue(true);
    await expect(
      requestClose({ kind: "window", dirtyCount: 1 }),
    ).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "关闭 Tauri Notes？",
        confirmLabel: "关闭",
      }),
    );
  });
});
