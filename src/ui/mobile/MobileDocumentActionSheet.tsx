import type { ActionDefinition } from "../../kernel/action";
import { MobileActionSheet } from "../shell/MobileActionSheet";
import type { MobileDocumentLink } from "./types";

export function MobileDocumentActionSheet({
  document,
  actions,
  onClose,
  onAction,
}: {
  document: MobileDocumentLink;
  actions: ActionDefinition[];
  onClose: () => void;
  onAction: (actionId: string, document: MobileDocumentLink) => void;
}) {
  return (
    <MobileActionSheet
      title={document.title}
      onClose={onClose}
      items={actions.map((action) => ({
        id: action.id,
        label: action.title,
        tone: action.id === "document.delete" ? "danger" : "default",
        onSelect: () => onAction(action.id, document),
      }))}
    />
  );
}