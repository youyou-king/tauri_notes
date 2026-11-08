import { useEffect } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import MindMap from "../../components/MindMap";
import { PanelIcon } from "../design-system/PanelIcon";
import { StateView } from "../design-system/StateView";
import { usePanelContext } from "./PanelContext";
import { APP_EVENTS, onAppEvent } from "../../kernel/events";

import type { LibraryId } from "../../types";

export type MapParams = {
  mapId?: string;
  libraryId?: LibraryId;
};

export function MapPanel(props: IDockviewPanelProps<MapParams>) {
  const context = usePanelContext();
  if (!context) {
    return null;
  }
  const requestedId = props.params?.libraryId;
  const mapWorkspace =
    context.workspaces.find((item) => item.id === requestedId) ??
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
        libraryId={mapWorkspace.id}
        mapId={map.id}
        mapTitle={map.title}
        selectedId={context.selected?.id ?? null}
        onOpenDocument={(documentId) =>
          context.openBlockDocument(documentId, undefined, mapWorkspace.id)
        }
      />
    );
  }
  return (
    <StateView
      className="map-placeholder"
      icon={<PanelIcon icon="▦" />}
      detail="打开一个 `.notes` 知识库"
    />
  );
}
