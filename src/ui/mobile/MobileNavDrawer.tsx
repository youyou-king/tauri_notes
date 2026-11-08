import { Button } from "../design-system/Button";
import { useEffect, useState } from "react";
import type { ToolbarItemContribution } from "../../kernel/plugin";
import { NAV_LABELS } from "../../app/commandLabels";
import { ModalSurface } from "../dialog/ModalSurface";

/**
 * Mobile global navigation. The knowledge submenu is built from the same
 * toolbar items as desktop, so command labels cannot drift between shells.
 */

export function MobileNavDrawer({
  open,
  workspaceTitle,
  knowledgeItems,
  onKnowledgeCommand,
  onManageLibraries,
  onClose,
  onHelp,
  onSettings,
}: {
  open: boolean;
  workspaceTitle: string;
  knowledgeItems: ToolbarItemContribution[];
  onKnowledgeCommand: (commandId: string | undefined) => void;
  onManageLibraries: () => void;
  onClose: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setKnowledgeOpen(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <ModalSurface
      className="mobile-drawer-backdrop"
      panelClassName="mobile-drawer"
      ariaLabel="导航"
      onClose={onClose}
    >
      <header className="mobile-drawer-header">
          <div className="mobile-drawer-brand">
            <span className="mobile-drawer-brand-mark">N</span>
            <div>
              <strong>Notes</strong>
              <span>{workspaceTitle}</span>
            </div>
          </div>
          <Button type="button" aria-label="关闭导航" onClick={onClose}>
            ×
          </Button>
        </header>

        <div className="mobile-drawer-scroll">
          <nav className="mobile-drawer-menu" aria-label="全局导航">
            <Button
              type="button"
              aria-expanded={knowledgeOpen}
              onClick={() => setKnowledgeOpen((current) => !current)}
            >
              {NAV_LABELS.knowledge}
              <span className="mobile-drawer-chevron" aria-hidden="true">
                {knowledgeOpen ? "⌄" : "›"}
              </span>
            </Button>
            {knowledgeOpen && (
              <div className="mobile-drawer-submenu">
                {knowledgeItems.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    onClick={() => onKnowledgeCommand(item.commandId)}
                  >
                    {item.label}
                  </Button>
                ))}
                <Button type="button" onClick={onManageLibraries}>
                  管理知识库
                </Button>
              </div>
            )}
            <Button type="button" onClick={onSettings}>
              {NAV_LABELS.settings}
            </Button>
            <Button type="button" onClick={onHelp}>
              {NAV_LABELS.help}
            </Button>
          </nav>
        </div>
    </ModalSurface>
  );
}