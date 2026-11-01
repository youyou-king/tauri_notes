import { describe, expect, it } from "vitest";
import {
  noteOpenRequest,
  openRequestPath,
  workspaceOpenRequest,
} from "./openRequest";

describe("open requests", () => {
  it("creates note requests with a source", () => {
    const request = noteOpenRequest("C:/notes/help.note", "drop");
    expect(request).toEqual({
      kind: "note",
      path: "C:/notes/help.note",
      source: "drop",
    });
    expect(openRequestPath(request)).toBe("C:/notes/help.note");
  });

  it("creates workspace requests", () => {
    expect(workspaceOpenRequest("C:/notes")).toEqual({
      kind: "workspace",
      path: "C:/notes",
      source: "dialog",
    });
  });
});
