import type { MobileTab } from "../../application/stores/mobileShellStore";

export function MobileTabBar({
  tab,
  documentId,
  onSwitchTab,
  onSettings,
}: {
  tab: MobileTab;
  documentId: string | null;
  onSwitchTab: (tab: MobileTab) => void;
  onSettings: () => void;
}) {
  return (
    <nav className="mobile-tabbar" aria-label="移动导航">
      <button
        type="button"
        className={tab === "map" ? "active" : ""}
        aria-current={tab === "map" ? "page" : undefined}
        onClick={() => onSwitchTab("map")}
      >
        导图
      </button>
      <button
        type="button"
        className={tab === "library" ? "active" : ""}
        aria-current={tab === "library" ? "page" : undefined}
        onClick={() => onSwitchTab("library")}
      >
        目录
      </button>
      <button
        type="button"
        className={tab === "document" ? "active" : ""}
        aria-current={tab === "document" ? "page" : undefined}
        onClick={() => onSwitchTab("document")}
        disabled={!documentId}
      >
        文档
      </button>
      <button type="button" onClick={onSettings}>
        设置
      </button>
    </nav>
  );
}