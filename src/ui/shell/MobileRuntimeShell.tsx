import type { ShellProps } from "../../runtime/contracts";
import { MobileShell } from "./MobileShell";

/**
 * Mobile shell adapter. It shares navigation and document pages with desktop,
 * but owns its compact header and bottom navigation. The desktop toolbar is
 * intentionally absent here.
 */
export function MobileRuntimeShell({
  pluginReady,
  error,
  workspace,
  activeMap,
  selected,
  board,
  onOpenWorkspace,
  onCreateKnowledgeBase,
  onOpenWorkspacePath,
}: ShellProps) {
  if (!pluginReady) {
    return (
      <div className="body">
        <div className="dock-workspace-loading">正在加载插件…</div>
      </div>
    );
  }

  return (
    <div className="body">
      <main className="workspace">
        <div className="workspace-header">
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="dock-fill">
          <MobileShell
            workspace={workspace}
            activeMap={activeMap}
            selected={selected}
            board={board}
            onOpenWorkspace={onOpenWorkspace}
            onCreateKnowledgeBase={onCreateKnowledgeBase}
            onOpenWorkspacePath={onOpenWorkspacePath}
          />
        </div>
      </main>
    </div>
  );
}