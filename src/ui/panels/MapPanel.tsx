import { useEffect } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import MindMap from "../../components/MindMap";
import { usePanelContext } from "./PanelContext";
import { APP_EVENTS, onAppEvent } from "../../kernel/events";

export type MapParams = {
  mapId?: string;
  workspaceRoot?: string;
};

export function MapPanel(props: IDockviewPanelProps<MapParams>) {
  const context = usePanelContext();
  if (!context) {
    return null;
  }
  const requestedRoot = props.params?.workspaceRoot;
  const mapWorkspace =
    context.workspaces.find((item) => item.root === requestedRoot) ??
    context.workspace;
  const paramMap = props.params?.mapId
    ? mapWorkspace?.maps.find((item) => item.id === props.params?.mapId)
    : null;
  const map =
    paramMap ?? context.activeMap ?? mapWorkspace?.maps[0] ?? null;

  useEffect(() => {
    if (map) {
      props.api.setTitle(map.title);
    }
  }, [map?.title, props.api]);

  useEffect(() => {
    return onAppEvent(APP_EVENTS.mapRenamed, (detail) => {
      if (detail?.mapId === map?.id && detail.title) {
        props.api.setTitle(detail.title);
      }
    });
  }, [map?.id, props.api]);

  if (map && mapWorkspace) {
    return (
      <MindMap
        workspaceRoot={mapWorkspace.root}
        mapId={map.id}
        mapTitle={map.title}
        selectedId={context.selected?.id ?? null}
        onOpenDocument={(documentId) =>
          context.openBlockDocument(documentId, undefined, mapWorkspace.root)
        }
      />
    );
  }
  return (
    <div className="map-placeholder">
      <span>▦</span>
      <p>打开一个 `.notes` 知识库</p>
    </div>
  );
}
