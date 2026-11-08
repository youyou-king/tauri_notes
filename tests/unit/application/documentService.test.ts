import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { documentService } from "../../../src/application/documentService";
import { mapService } from "../../../src/application/mapService";

describe("library id document services", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue([]);
  });

  it("sends libraryId instead of workspace paths", async () => {
    await documentService.list("lib_demo");
    expect(invoke).toHaveBeenCalledWith("list_imported_documents", {
      libraryId: "lib_demo",
    });

    await documentService.loadBlocks("lib_demo", "map/doc");
    expect(invoke).toHaveBeenCalledWith("load_document_blocks", {
      libraryId: "lib_demo",
      documentId: "map/doc",
    });
  });

  it("uses libraryId for map commands", async () => {
    await mapService.loadMap("lib_demo", "map_1");
    expect(invoke).toHaveBeenCalledWith("load_mind_map", {
      libraryId: "lib_demo",
      mapId: "map_1",
    });
  });
});