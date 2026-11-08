import { useEffect } from "react";
import { AppToolbar } from "../../app/AppToolbar";
import DockWorkspace from "../../components/DockWorkspace";
import { useRuntimeServices } from "../../runtime";
import type { ShellProps } from "../../runtime/contracts";

/**
 * Desktop shell: owns the desktop toolbar and the Dockview workspace. It has
 * no knowledge of the mobile runtime; both shells receive the same props.
 */
export function DesktopShell({
  pluginReady,
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
  const { workspacePresenter } = useRuntimeServices();

  useEffect(() => {
    workspacePresenter.bind({
      present(view, isNote) {
        const map = view.maps[0] ?? null;
        const root = map?.root ?? null;
        if (map && isNote) {
          dockRef.current?.openMap(map.id, view.id);
        } else if (map && root) {
          dockRef.current?.openDocument(
            map.id,
            root.id,
            root.title,
            view.id,
          );
        }
      },
      resetLayout() {
        dockRef.current?.resetLayout();
      },
      activatePanel(panelId) {
        dockRef.current?.activatePanel(panelId);
      },
    });
    return () => workspacePresenter.bind(null);
  }, [dockRef, workspacePresenter]);

  return (
    <>
      <AppToolbar
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