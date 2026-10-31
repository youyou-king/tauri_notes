export const APP_EVENTS = {
  settingsOpen: "settings:open",
  searchOpen: "search:open",
  helpOpen: "help:open",
  boardOpen: "board:open",
  themeOpen: "theme:open",
  blocksSaved: "tauri-notes:blocks-saved",
  documentChanged: "tauri-notes:document-changed",
  documentDeleted: "tauri-notes:document-deleted",
  documentRenamed: "tauri-notes:document-renamed",
  mapsChanged: "tauri-notes:maps-changed",
  mapRenamed: "tauri-notes:map-renamed",
  openBlockDocument: "tauri-notes:open-block-document",
  openSource: "tauri-notes:open-source",
  saveNow: "tauri-notes:save-now",
  insertEmbed: "tauri-notes:insert-embed",
} as const;

export type AppEventName =
  (typeof APP_EVENTS)[keyof typeof APP_EVENTS];

type AppEventPayloads = {
  "settings:open": void;
  "search:open": void;
  "help:open": void;
  "board:open": void;
  "theme:open": void;
  "tauri-notes:blocks-saved": {
    documentId: string;
    blockIds: string[];
    deletedBlockIds: string[];
  };
  "tauri-notes:document-changed": void;
  "tauri-notes:document-deleted": {
    documentId?: string;
    root?: string;
  };
  "tauri-notes:document-renamed": {
    documentId?: string;
    title?: string;
  };
  "tauri-notes:maps-changed": {
    root?: string;
  };
  "tauri-notes:map-renamed": {
    mapId: string;
    title: string;
  };
  "tauri-notes:open-block-document": string;
  "tauri-notes:open-source": string;
  "tauri-notes:save-now": void;
  "tauri-notes:insert-embed": {
    docId?: string;
    marker: string;
  };
};

export function emitAppEvent<K extends AppEventName>(
  name: K,
  payload?: AppEventPayloads[K],
): void {
  window.dispatchEvent(
    new CustomEvent(name, { detail: payload }),
  );
}

export function onAppEvent<K extends AppEventName>(
  name: K,
  handler: (payload: AppEventPayloads[K]) => void,
): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<AppEventPayloads[K]>).detail);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
