import type { MobileTab } from "../../application/stores/mobileShellStore";

export function MobileHeader({
  tab,
  mapTitle,
  workspaceTitle,
  canGoBack,
  onBack,
  onSearch,
  onHelp,
  onBoard,
}: {
  tab: MobileTab;
  mapTitle: string;
  workspaceTitle: string;
  canGoBack: boolean;
  onBack: () => void;
  onSearch: () => void;
  onHelp: () => void;
  onBoard: () => void;
}) {
  return (
    <header className="mobile-shell-header">
      {canGoBack && (
        <button type="button" aria-label="返回" onClick={onBack}>
          返回
        </button>
      )}
      <div>
        <strong>
          {tab === "map" ? mapTitle : tab === "library" ? "目录" : "文档"}
        </strong>
        <span>{workspaceTitle}</span>
      </div>
      <div className="mobile-shell-actions">
        <button type="button" onClick={onSearch}>
          搜索
        </button>
        <button type="button" onClick={onHelp}>
          帮助
        </button>
        <button type="button" onClick={onBoard}>
          看板
        </button>
      </div>
    </header>
  );
}