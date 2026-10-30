import { describe, expect, it } from "vitest";
import {
  createPluginHost,
  validatePluginManifest,
} from "../../kernel/sdk";
import { boardPlugin } from "./index";
import { boardFeature } from "./manifest";

describe("board plugin", () => {
  it("validates and registers its panel and command", async () => {
    expect(validatePluginManifest(boardFeature)).toEqual([]);
    const host = createPluginHost([
      {
        manifest: boardFeature,
        createModule: () => boardPlugin,
      },
    ]);

    await host.start();
    expect(host.getContributions("commands")[0]?.id).toBe("board.open");
    expect(host.getContributions("panels")[0]?.id).toBe("board");
    expect(host.getContributions("panels")[0]?.renderer).toBe(
      "board.panel",
    );
    await host.stop();
  });
});
