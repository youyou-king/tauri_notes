export const APP_EVENTS = {
  settingsOpen: "settings:open",
  searchOpen: "search:open",
  helpOpen: "help:open",
  boardOpen: "board:open",
  themeOpen: "theme:open",
} as const;

export type AppEventName =
  (typeof APP_EVENTS)[keyof typeof APP_EVENTS];

type AppEventPayloads = {
  "settings:open": void;
  "search:open": void;
  "help:open": void;
  "board:open": void;
  "theme:open": void;
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
