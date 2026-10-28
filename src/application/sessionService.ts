export const SESSION_KEY = "tauri-notes.session.v1";
const TITLE_PREFIX = "tauri-notes.workspace-title:";

export type SessionSnapshot = {
  version: 1;
  roots: string[];
  activeRoot: string | null;
};

export function readSession(): SessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      roots?: unknown;
      active?: unknown;
      activeRoot?: unknown;
    };
    return {
      version: 1,
      roots: Array.isArray(parsed.roots)
        ? parsed.roots.filter(
            (root): root is string => typeof root === "string",
          )
        : [],
      activeRoot:
        typeof parsed.activeRoot === "string"
          ? parsed.activeRoot
          : typeof parsed.active === "string"
            ? parsed.active
            : null,
    };
  } catch {
    return null;
  }
}

export function writeSession(
  roots: string[],
  activeRoot: string | null,
): void {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      version: 1,
      roots,
      activeRoot,
    }),
  );
}

export function readWorkspaceTitle(root: string): string | null {
  return window.localStorage.getItem(`${TITLE_PREFIX}${root}`);
}

export function writeWorkspaceTitle(root: string, title: string): void {
  window.localStorage.setItem(`${TITLE_PREFIX}${root}`, title);
}

export function clearWorkspaceTitle(root: string): void {
  window.localStorage.removeItem(`${TITLE_PREFIX}${root}`);
}
