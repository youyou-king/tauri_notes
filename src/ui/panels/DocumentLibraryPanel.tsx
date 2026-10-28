import DocumentLibraryPane from "../library/DocumentLibraryPane";
import { usePanelContext } from "./PanelContext";

export function DocumentLibraryPanel() {
  const context = usePanelContext();
  if (!context?.workspace || !context.activeMap) {
    return null;
  }
  return (
    <DocumentLibraryPane
      workspaceRoot={context.workspace.root}
      mapId={context.activeMap.id}
    />
  );
}
