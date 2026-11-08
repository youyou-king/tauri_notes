const STORAGE_KEY = "tauri-notes.map-viewport.v1";

export type MapViewport = {
  x: number;
  y: number;
  zoom: number;
};

function viewportKey(libraryId: string, mapId: string): string {
  return `${libraryId}\u0000${mapId}`;
}

export function readMapViewport(
  libraryId: string,
  mapId: string,
): MapViewport | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[viewportKey(libraryId, mapId)] as
      | Partial<MapViewport>
      | undefined;
    if (
      !value ||
      typeof value.x !== "number" ||
      typeof value.y !== "number" ||
      typeof value.zoom !== "number" ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      !Number.isFinite(value.zoom) ||
      value.zoom <= 0
    ) {
      return null;
    }
    return { x: value.x, y: value.y, zoom: value.zoom };
  } catch {
    return null;
  }
}

export function writeMapViewport(
  libraryId: string,
  mapId: string,
  viewport: MapViewport,
): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let all: Record<string, unknown> = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object") {
          all = parsed as Record<string, unknown>;
        }
      } catch {
        all = {};
      }
    }
    all[viewportKey(libraryId, mapId)] = viewport;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Viewport persistence is best effort.
  }
}