import type { IDockviewPanelProps } from "dockview-react";
import BoardView from "./ui/BoardView";
import { usePanelContext } from "../../ui/sdk";

export function BoardPanel(props: IDockviewPanelProps) {
  const context = usePanelContext();
  if (!context) {
    return null;
  }
  return (
    <BoardView
      controller={context.board}
      targetDocId={context.lastActiveDocId}
      onClose={props.api.close}
      onOpenSource={(docId) => {
        const separator = docId.indexOf("/");
        if (separator <= 0) {
          return;
        }
        context.openDocument(
          docId.slice(0, separator),
          docId.slice(separator + 1),
        );
      }}
    />
  );
}
