import { AppToolbar } from "../../app/AppToolbar";
import DockWorkspace from "../../components/DockWorkspace";
import type { ShellProps } from "../../runtime/contracts";

/**
 * Desktop shell: owns the desktop toolbar and the Dockview workspace. It has
 * no knowledge of the mobile runtime; both shells receive the same props.
 */
export function DesktopShell({
  pluginReady,
  backend,
  busy,
  error,
  runCommand,
  dockRef,
  workspace,
  workspaces,
  activeMap,
  selected,
  onActiveNode,
  onActiveMap,
  onPanelDirty,
  onPanelActive,
  onSelectNode,
  onSwitchMap,
  onActivateWorkspace,
  onUnloadWorkspace,
  onRenameWorkspace,
  onPinBlock,
  board,
}: ShellProps) {
  return (
    <>
      <AppToolbar
        backend={backend}
        busy={busy}
        hasWorkspace={Boolean(workspace)}
        runCommand={runCommand}
      />

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
            {pluginReady ? (
              <DockWorkspace
                ref={dockRef}
                workspace={workspace}
                workspaces={workspaces}
                activeMap={activeMap}
                selected={selected}
                onActiveNode={onActiveNode}
                onActiveMap={onActiveMap}
                onPanelDirty={onPanelDirty}
                onPanelActive={onPanelActive}
                onSelectNode={onSelectNode}
                onSwitchMap={onSwitchMap}
                onActivateWorkspace={onActivateWorkspace}
                onUnloadWorkspace={onUnloadWorkspace}
                onRenameWorkspace={onRenameWorkspace}
                onPinBlock={onPinBlock}
                board={board}
              />
            ) : (
              <div className="dock-workspace-loading">正在加载插件…</div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}