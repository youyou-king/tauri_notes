let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function openSearchOverlay(): void {
  if (!open) {
    open = true;
    emit();
  }
}

export function closeSearchOverlay(): void {
  if (open) {
    open = false;
    emit();
  }
}

export function subscribeSearchOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSearchOverlaySnapshot(): boolean {
  return open;
}
