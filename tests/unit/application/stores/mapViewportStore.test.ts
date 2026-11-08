import { beforeEach, describe, expect, it } from "vitest";
import {
  readMapViewport,
  writeMapViewport,
} from "../../../../src/application/stores/mapViewportStore";

describe("map viewport store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a viewport per library and map", () => {
    writeMapViewport("lib_1", "map_1", { x: 12, y: 34, zoom: 0.8 });
    writeMapViewport("lib_1", "map_2", { x: -5, y: 6, zoom: 1.2 });
    expect(readMapViewport("lib_1", "map_1")).toEqual({
      x: 12,
      y: 34,
      zoom: 0.8,
    });
    expect(readMapViewport("lib_1", "map_2")).toEqual({
      x: -5,
      y: 6,
      zoom: 1.2,
    });
    expect(readMapViewport("lib_2", "map_1")).toBeNull();
  });

  it("ignores malformed viewport data", () => {
    window.localStorage.setItem(
      "tauri-notes.map-viewport.v1",
      JSON.stringify({
        "lib_1\u0000map_1": { x: 0, y: 0, zoom: 0 },
      }),
    );
    expect(readMapViewport("lib_1", "map_1")).toBeNull();
    window.localStorage.setItem(
      "tauri-notes.map-viewport.v1",
      "{bad json",
    );
    expect(readMapViewport("lib_1", "map_1")).toBeNull();
  });
});