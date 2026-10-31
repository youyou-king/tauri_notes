import { useEffect, useState } from "react";
import type { IDockviewPanelHeaderProps } from "dockview-react";
import { usePanelStore } from "../../application/stores/panelStore";
import { confirmDialog } from "../dialog/confirmDialog";
import { getPanelIcon } from "./registry";

export function WorkspaceTab(props: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(props.api.title);
  const dirty = usePanelStore((state) =>
    Boolean(state.dirtyPanels[props.api.id]),
  );
  const icon = getPanelIcon(props.api.component);

  useEffect(() => {
    const disposable = props.api.onDidTitleChange((event) => {
      setTitle(event.title);
    });
    return () => disposable.dispose();
  }, [props.api]);

  return (
    <div className="workspace-tab">
      <span className="workspace-tab-title">
        {icon && <span className="workspace-tab-icon">{icon}</span>}
        {title}
      </span>
      <button
        type="button"
        className="workspace-tab-close"
        title="关闭面板"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (!dirty) {
            props.api.close();
            return;
          }
          void confirmDialog({
            title: "关闭未保存的文档？",
            message: "这个面板还有未保存的修改，关闭会丢弃修改。",
            confirmLabel: "放弃并关闭",
            tone: "danger",
          }).then((confirmed) => {
            if (confirmed) {
              props.api.close();
            }
          });
        }}
      >
        ×
      </button>
    </div>
  );
}
