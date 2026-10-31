import type {
  AppearanceMode,
  AppearancePackManifest,
} from "./appearancePack";

const DB_NAME = "tauri-notes-assets";
const STORE = "appearance";
const WALLPAPER_KEY = "wallpaper";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    return await new Promise<T>((resolve, reject) => {
      const request = run(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function saveWallpaperAsset(
  bytes: Uint8Array,
): Promise<void> {
  await withStore("readwrite", (store) =>
    store.put(bytes, WALLPAPER_KEY),
  );
}

export async function loadWallpaperAsset(): Promise<Uint8Array | null> {
  try {
    const value = await withStore<Uint8Array | undefined>(
      "readonly",
      (store) => store.get(WALLPAPER_KEY),
    );
    return value ?? null;
  } catch {
    return null;
  }
}

export async function clearWallpaperAsset(): Promise<void> {
  try {
    await withStore("readwrite", (store) =>
      store.delete(WALLPAPER_KEY),
    );
  } catch {
    // Clearing is best effort.
  }
}

const DECORATION_COUNT_KEY = "decoration-count";

function decorationKey(index: number): string {
  return `decoration:${index}`;
}

export async function saveDecorationAssets(
  assets: Uint8Array[],
): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    await new Promise<void>((resolve, reject) => {
      const count = store.put(assets.length, DECORATION_COUNT_KEY);
      count.onsuccess = () => resolve();
      count.onerror = () => reject(count.error);
    });
    await Promise.all(
      assets.map(
        (bytes, index) =>
          new Promise<void>((resolve, reject) => {
            const request = store.put(bytes, decorationKey(index));
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }),
      ),
    );
    transaction.commit();
  } finally {
    database.close();
  }
}

export async function loadDecorationAssets(): Promise<Uint8Array[]> {
  try {
    const database = await openDatabase();
    try {
      const count = await new Promise<number>((resolve, reject) => {
        const transaction = database.transaction(STORE, "readonly");
        const request = transaction
          .objectStore(STORE)
          .get(DECORATION_COUNT_KEY);
        request.onsuccess = () => resolve(request.result ?? 0);
        request.onerror = () => reject(request.error);
      });
      if (!count || count > 32) {
        return [];
      }
      const assets: Uint8Array[] = [];
      for (let index = 0; index < count; index += 1) {
        const bytes = await new Promise<Uint8Array | undefined>(
          (resolve, reject) => {
            const transaction = database.transaction(STORE, "readonly");
            const request = transaction
              .objectStore(STORE)
              .get(decorationKey(index));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          },
        );
        if (bytes) {
          assets.push(bytes);
        }
      }
      return assets;
    } finally {
      database.close();
    }
  } catch {
    return [];
  }
}

export type StoredDecorationAsset = {
  bytes: Uint8Array;
  anchor: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  width: string;
  opacity: number;
  hideBelow?: number;
};

export type StoredVariantAssets = {
  wallpaper?: Uint8Array;
  decorations: StoredDecorationAsset[];
};

export type StoredAppearanceRuntime = {
  pack: AppearancePackManifest;
  assets: Partial<Record<AppearanceMode, StoredVariantAssets>>;
};

const RUNTIME_KEY = "runtime:v1";

export async function saveAppearanceRuntime(
  runtime: StoredAppearanceRuntime,
): Promise<void> {
  await withStore("readwrite", (store) =>
    store.put(runtime, RUNTIME_KEY),
  );
}

export async function loadAppearanceRuntime(): Promise<StoredAppearanceRuntime | null> {
  try {
    const value = await withStore<StoredAppearanceRuntime | undefined>(
      "readonly",
      (store) => store.get(RUNTIME_KEY),
    );
    return value ?? null;
  } catch {
    return null;
  }
}

export async function clearAppearanceRuntime(): Promise<void> {
  try {
    await withStore("readwrite", (store) =>
      store.delete(RUNTIME_KEY),
    );
  } catch {
    // Clearing is best effort.
  }
}
