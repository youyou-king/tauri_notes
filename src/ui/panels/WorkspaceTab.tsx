import { useEffect, useState } from "react";
import type { IDockviewPanelHeaderProps } from "dockview-react";
import { getPanelIcon } from "./registry";

export function WorkspaceTab(props: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(props.api.title);
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
          props.api.close();
        }}
      >
        ×
      </button>
    </div>
  );
}
