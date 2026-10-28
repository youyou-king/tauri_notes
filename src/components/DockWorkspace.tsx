import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  DockviewReact,
  themeAbyss,
  themeLight,
  type DockviewApi,
  type DockviewReadyEvent,
} from "dockview-react";
import {
  PanelContext,
  type PanelContextValue,
  type PinBlockInput,
} from "../ui/panels/PanelContext";
import { ConsolePanel } from "../ui/panels/ConsolePanel";
import { DocumentLibraryPanel } from "../ui/panels/DocumentLibraryPanel";
import { MapPanel, type MapParams } from "../ui/panels/MapPanel";
import { BoardPanel } from "../ui/panels/BoardPanel";
import { WorkspaceTab } from "../ui/panels/WorkspaceTab";
import { MultiOutlinePanel } from "../ui/panels/OutlinePanel";
import {
  BlockDocumentPanel,
  type BlockDocParams,
} from "../ui/panels/BlockDocumentPanel";
import {
  getPanelComponents,
  registerPanel,
} from "../ui/panels/registry";
import type { BoardController } from "../ui/board/useBoardController";
import type { MapView, NodeView, WorkspaceView } from "../types";
import { findNode } from "../domain/tree";
import { useTheme } from "../ui/theme/ThemeProvider";

export const DOCK_LAYOUT_KEY = "tauri-notes.dock-layout.v21";

export type DockWorkspaceHandle = {
  openDocument: (
    mapId: string,
    nodeId: string,
    title?: string,
    workspaceRoot?: string,
  ) => void;
  openMap: (mapId: string, workspaceRoot?: string) => void;
  openBoard: () => void;
  openBlockDocument: (
    documentId: string,
    title?: string,
    workspaceRoot?: string,
  ) => void;
  openLibrary: () => void;
  togglePanel: (panelId: string) => void;
  closeWorkspacePanels: (
    workspaceRoot: string,
    workspace?: WorkspaceView | null,
  ) => void;
  resetLayout: () => void;
};



registerPanel({
  id: "outline",
  component: MultiOutlinePanel,
  icon: "🗂",
  defaultTitle: "大纲",
  singleton: true,
});
registerPanel({
  id: "map",
  component: MapPanel,
  icon: "🌳",
  defaultTitle: "导图",
});
registerPanel({
  id: "console",
  component: ConsolePanel,
  icon: "⌨",
  defaultTitle: "控制台",
  singleton: true,
});
registerPanel({
  id: "board",
  component: BoardPanel,
  icon: "🧩",
  defaultTitle: "对照板",
  singleton: true,
});
registerPanel({
  id: "library",
  component: DocumentLibraryPanel,
  icon: "📚",
  defaultTitle: "文档库",
  singleton: true,
});
registerPanel({
  id: "blockdoc",
  component: BlockDocumentPanel,
  icon: "📄",
  defaultTitle: "文档",
});

const components = getPanelComponents() as any;

export default forwardRef<
  DockWorkspaceHandle,
  {
    workspace: WorkspaceView | null;
    workspaces: WorkspaceView[];
    activeMap: MapView | null;
    selected: NodeView | null;
    logs: string[];
    onActiveNode: (node: NodeView) => void;
    onPanelDirty: (panelId: string, dirty: boolean) => void;
    onSelectNode: (node: NodeView, newPanel: boolean) => void;
    onSwitchMap: (map: MapView, workspaceRoot?: string) => void;
    onActivateWorkspace: (root: string) => void;
    onUnloadWorkspace: (root: string) => void;
    onRenameWorkspace: (root: string, title: string) => void;
    onPinBlock: (input: PinBlockInput) => void | Promise<void>;
    board: BoardController;
  }
>(function DockWorkspace(
  {
    workspace,
    workspaces,
    activeMap,
    selected,
    logs,
    onActiveNode,
    onPanelDirty,
    onSelectNode,
    onSwitchMap,
    onActivateWorkspace,
    onUnloadWorkspace,
    onRenameWorkspace,
    onPinBlock,
    board,
  },
  ref,
) {
  const { resolved } = useTheme();
  const dockTheme = resolved === "light" ? themeLight : themeAbyss;
  const apiRef = useRef<DockviewApi | null>(null);
  const pendingOpen = useRef<{
    mapId: string;
    nodeId: string;
  } | null>(null);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [lastActiveDocId, setLastActiveDocId] = useState<string | null>(null);

  useEffect(() => {
    const api = apiRef.current;
    const panel = api?.getPanel("map");
    if (panel && !panel.api.getParameters<MapParams>().mapId) {
      panel.api.setTitle(activeMap?.title ?? "导图");
    }
  }, [activeMap?.title]);

  function resolveNodeById(docId: string): NodeView | null {
    const [mapId, nodeId] = docId.split("/");
    const map = workspace?.maps.find((item) => item.id === mapId);
    return map && nodeId ? findNode(map.root, nodeId) : null;
  }

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !workspace) {
      return;
    }
    api.panels.forEach((panel) => {
      if (!panel.id.startsWith("blockdoc_")) {
        return;
      }
      const documentId =
        panel.api.getParameters<BlockDocParams>()?.documentId;
      if (!documentId) {
        return;
      }
      const node = resolveNodeById(documentId);
      if (node) {
        panel.api.setTitle(node.title);
      }
    });
  }, [workspace]);

  function applyDefaultPaneSizes(api: DockviewApi) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        api.getPanel("outline")?.group.api.setSize({ width: 240 });
        api.getPanel("map")?.group.api.setSize({ width: 320 });
      });
    });
  }

  function openDocument(
    mapId: string,
    nodeId: string,
    title?: string,
    workspaceRoot?: string,
  ) {
    const api = apiRef.current;
    if (!api) {
      pendingOpen.current = { mapId, nodeId };
      return;
    }
    openBlockDocument(`${mapId}/${nodeId}`, title, workspaceRoot);
  }

  function openMap(mapId: string, workspaceRoot?: string) {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const targetWorkspace =
      workspaces.find((item) => item.root === workspaceRoot) ?? workspace;
    const map = targetWorkspace?.maps.find((item) => item.id === mapId);
    const title = map?.title ?? "导图";
    const params: MapParams = { mapId, workspaceRoot: targetWorkspace?.root };
    const mapPanels = api.panels.filter(
      (panel) => panel.api.component === "map",
    );
    const matching = mapPanels.find(
      (panel) =>
        panel.api.getParameters<MapParams>().mapId === mapId &&
        panel.api.getParameters<MapParams>().workspaceRoot ===
          targetWorkspace?.root,
    );
    if (matching) {
      matching.api.updateParameters(params);
      matching.api.setTitle(title);
      matching.api.setActive();
      return;
    }
    const unbound = mapPanels.find(
      (panel) => !panel.api.getParameters<MapParams>().mapId,
    );
    if (unbound) {
      unbound.api.updateParameters(params);
      unbound.api.setTitle(title);
      unbound.api.setActive();
      return;
    }

    const panelId = `map_${(targetWorkspace?.root ?? "").replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    )}_${mapId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const existing = api.getPanel(panelId);
    if (existing) {
      existing.api.updateParameters(params);
      existing.api.setTitle(title);
      existing.api.setActive();
      return;
    }
    const reference = api.activePanel?.id;
    const panel = api.addPanel({
      id: panelId,
      component: "map",
      title,
      params,
      ...(reference
        ? {
            position: {
              referencePanel: reference,
              direction: "right" as const,
            },
            initialWidth: 420,
          }
        : {}),
    });
    panel.api.setActive();
  }

  function openBoard() {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const existing = api.getPanel("board");
    if (existing) {
      existing.api.setActive();
      return;
    }
    const reference = api.activePanel?.id ?? api.getPanel("outline")?.id;
    const panel = api.addPanel({
      id: "board",
      component: "board",
      title: "对照板",
      ...(reference
        ? {
            position: {
              referencePanel: reference,
              direction: "right" as const,
            },
            initialWidth: 520,
          }
        : {}),
    });
    panel.api.setActive();
  }

  function openBlockDocument(
    documentId: string,
    knownTitle?: string,
    workspaceRoot?: string,
  ) {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const targetRoot = workspaceRoot ?? workspace?.root ?? "";
    const panelId = `blockdoc_${targetRoot.replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    )}_${documentId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const targetWorkspace = workspaces.find(
      (item) => item.root === targetRoot,
    );
    const [mapId, nodeId] = documentId.split("/");
    const map = targetWorkspace?.maps.find((item) => item.id === mapId);
    const node = map && nodeId ? findNode(map.root, nodeId) : null;
    const title = knownTitle ?? node?.title ?? documentId;
    const existing = api.getPanel(panelId);
    if (existing) {
      existing.api.setTitle(title);
      existing.api.setActive();
      return;
    }
    api.addPanel({
      id: panelId,
      component: "blockdoc",
      title: title,
      params: { documentId, workspaceRoot: targetRoot },
    });
  }

  function openLibrary() {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const existing = api.getPanel("library");
    if (existing) {
      existing.api.setActive();
      return;
    }
    api.addPanel({
      id: "library",
      component: "library",
      title: "文档库",
    });
  }

  function togglePanel(panelId: string) {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const existing = api.getPanel(panelId);
    if (existing) {
      existing.api.setActive();
      return;
    }
    if (panelId === "outline") {
      api.addPanel({
        id: "outline",
        component: "outline",
        title: "大纲",
        position: { direction: "left" },
      });
    } else if (panelId === "console") {
      api.addPanel({
        id: "console",
        component: "console",
        title: "控制台",
        position: { direction: "below" },
      });
    }
  }

  function closeOrphanMapPanels(api: DockviewApi) {
    const valid = new Set<string>();
    for (const item of workspaces) {
      for (const map of item.maps) {
        valid.add(`${item.root}\u0000${map.id}`);
      }
    }
    for (const panel of [...api.panels]) {
      if (panel.api.component !== "map") {
        continue;
      }
      const params = panel.api.getParameters<MapParams>();
      if (!params.mapId) {
        continue;
      }
      const root = params.workspaceRoot ?? workspace?.root ?? "";
      if (!valid.has(`${root}\u0000${params.mapId}`)) {
        panel.api.close();
      }
    }
  }

  useEffect(() => {
    const api = apiRef.current;
    if (api) {
      closeOrphanMapPanels(api);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces, workspace?.root]);

  function closeWorkspacePanels(
    workspaceRoot: string,
    targetWorkspace?: WorkspaceView | null,
  ) {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const mapIds = new Set(
      (targetWorkspace?.maps ?? []).map((map) => map.id),
    );
    const isActiveRoot = workspace?.root === workspaceRoot;
    for (const panel of [...api.panels]) {
      const params = panel.api.getParameters<{
        workspaceRoot?: string;
        mapId?: string;
        documentId?: string;
      }>();
      if (panel.api.component === "map") {
        const belongs =
          params.workspaceRoot === workspaceRoot ||
          (params.mapId ? mapIds.has(params.mapId) : isActiveRoot);
        if (belongs) {
          panel.api.close();
        }
        continue;
      }
      if (panel.api.component === "blockdoc") {
        const [mapId] = (params.documentId ?? "").split("/");
        const belongs =
          params.workspaceRoot === workspaceRoot ||
          (mapId ? mapIds.has(mapId) : false) ||
          (isActiveRoot && !params.workspaceRoot);
        if (belongs) {
          panel.api.close();
        }
      }
    }
  }

  function resetLayout() {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    for (const panel of [...api.panels]) {
      panel.api.close();
    }
    buildDefaultLayout(api);
  }

  useImperativeHandle(ref, () => ({
    openDocument,
    openMap,
    openBoard,
    openBlockDocument,
    openLibrary,
    togglePanel,
    closeWorkspacePanels,
    resetLayout,
  }));

  function buildDefaultLayout(api: DockviewApi) {
    api.addPanel({
      id: "outline",
      component: "outline",
      title: "大纲",
    });
    api.addPanel({
      id: "map",
      component: "map",
      title: activeMap?.title ?? "导图",
      position: { referencePanel: "outline", direction: "right" },
      initialWidth: 380,
      inactive: true,
    });

    try {
      api.addPanel({
        id: "console",
        component: "console",
        title: "控制台",
        position: { referencePanel: "map", direction: "within" },
        inactive: true,
      });
    } catch {
      // 导图面板不可用时，控制台作为独立面板追加。
      api.addPanel({
        id: "console",
        component: "console",
        title: "控制台",
      });
    }

    requestAnimationFrame(() => {
      api.getPanel("outline")?.group.api.setSize({ width: 260 });
      api.getPanel("map")?.group.api.setSize({ width: 380 });
    });
  }

  function onReady(event: DockviewReadyEvent) {
    apiRef.current = event.api;

    const saved = window.localStorage.getItem(DOCK_LAYOUT_KEY);
    if (saved) {
      try {
        event.api.fromJSON(JSON.parse(saved));
      } catch {
        window.localStorage.removeItem(DOCK_LAYOUT_KEY);
      }
    }

    if (event.api.panels.length === 0) {
      buildDefaultLayout(event.api);
    }
    closeOrphanMapPanels(event.api);

    setActivePanelId(event.api.activePanel?.id ?? null);

    event.api.onDidLayoutChange(() => {
      window.localStorage.setItem(
        DOCK_LAYOUT_KEY,
        JSON.stringify(event.api.toJSON()),
      );
    });

    event.api.onDidActivePanelChange((event) => {
      const panel = event.panel;
      setActivePanelId(panel?.id ?? null);
      if (panel?.id.startsWith("blockdoc_")) {
        const params = panel.api.getParameters<BlockDocParams>();
        const documentId = params?.documentId;
        if (documentId) {
          setLastActiveDocId(documentId);
          const node = resolveNodeById(documentId);
          if (node) {
            onActiveNode(node);
          }
        }
      }
    });

    const pending = pendingOpen.current;
    if (pending) {
      pendingOpen.current = null;
      openDocument(pending.mapId, pending.nodeId);
    }
    applyDefaultPaneSizes(event.api);
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ root?: string; documentId?: string }>
      ).detail;
      const api = apiRef.current;
      if (!api || !detail?.documentId) {
        return;
      }
      for (const panel of [...api.panels]) {
        if (panel.api.component !== "blockdoc") {
          continue;
        }
        const params = panel.api.getParameters<{
          workspaceRoot?: string;
          documentId?: string;
        }>();
        if (
          params.documentId === detail.documentId &&
          (!detail.root || params.workspaceRoot === detail.root)
        ) {
          panel.api.close();
        }
      }
    };
    window.addEventListener("tauri-notes:document-deleted", handler);
    return () =>
      window.removeEventListener("tauri-notes:document-deleted", handler);
  }, []);

  const contextValue: PanelContextValue = {
    workspace,
    workspaces,
    activeMap,
    activePanelId,
    selected,
    logs,
    openDocument,
    openBlockDocument,
    setPanelDirty: onPanelDirty,
    onSelectNode,
    onSwitchMap,
    onActivateWorkspace,
    onUnloadWorkspace,
    onRenameWorkspace,
    onPinBlock,
    board,
    lastActiveDocId,
  };

  return (
    <PanelContext.Provider value={contextValue}>
      <DockviewReact
        className="dock-workspace"
        theme={dockTheme}
        components={components}
        defaultTabComponent={WorkspaceTab}
        onReady={onReady}
        dndStrategy="html5"
      />
    </PanelContext.Provider>
  );
});

