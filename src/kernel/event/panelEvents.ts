export const PANEL_DRAG_MIME = "application/x-tauri-notes-panel";

export type PanelDragPayload =
  | {
      kind: "document";
      root: string;
      documentId: string;
      title?: string;
    }
  | {
      kind: "reference";
      documentId: string;
      blockIds: string[];
      title?: string;
    }
  | {
      kind: "text";
      text: string;
    };

export type PanelEvent =
  | {
      type: "drag-start";
      sourcePanel?: string;
      payload: PanelDragPayload;
    }
  | {
      type: "drop";
      targetPanel?: string;
      payload: PanelDragPayload;
    }
  | {
      type: "drag-end";
      payload?: PanelDragPayload;
    };

type Listener = (event: PanelEvent) => void;

class CrossPanelBus {
  private active: { sourcePanel?: string; payload: PanelDragPayload } | null =
    null;
  private listeners = new Set<Listener>();

  startDrag(payload: PanelDragPayload, sourcePanel?: string): void {
    this.active = { sourcePanel, payload };
    const event: PanelEvent = {
      type: "drag-start",
      sourcePanel,
      payload,
    };
    this.emit(event);
  }

  endDrag(): void {
    const event: PanelEvent = {
      type: "drag-end",
      payload: this.active?.payload,
    };
    this.active = null;
    this.emit(event);
  }

  getActive(): PanelDragPayload | null {
    return this.active?.payload ?? null;
  }

  write(dataTransfer: DataTransfer, payload: PanelDragPayload): void {
    dataTransfer.setData(PANEL_DRAG_MIME, JSON.stringify(payload));
    dataTransfer.effectAllowed = "copy";
  }

  read(dataTransfer: DataTransfer | null): PanelDragPayload | null {
    if (dataTransfer) {
      const raw = dataTransfer.getData(PANEL_DRAG_MIME);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PanelDragPayload;
          if (parsed && typeof parsed.kind === "string") {
            return parsed;
          }
        } catch {
          // Fall through to the in-memory drag state.
        }
      }
    }
    return this.getActive();
  }

  emit(event: PanelEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
    window.dispatchEvent(
      new CustomEvent<PanelEvent>("tauri-notes:panel-event", {
        detail: event,
      }),
    );
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const crossPanelBus = new CrossPanelBus();
