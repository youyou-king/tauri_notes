import { Button } from "../design-system/Button";
import type { ManagedLibrarySummary } from "../../application/managedLibraryService";

export function MobileManagedLibraries({
  libraries,
  workspaceId,
  onOpen,
  onImport,
  onExport,
  onShare,
}: {
  libraries: ManagedLibrarySummary[];
  workspaceId: string | null;
  onOpen: (path: string) => void;
  onImport: () => void;
  onExport: (library: ManagedLibrarySummary) => void;
  onShare: (library: ManagedLibrarySummary) => void;
}) {
  const isActive = (item: ManagedLibrarySummary) =>
    workspaceId !== null && item.id === workspaceId;
  return (
    <section className="mobile-managed-libraries">
      <div className="mobile-managed-header">
        <h2>本机书库</h2>
        <Button type="button" onClick={onImport}>
          导入
        </Button>
      </div>
      {libraries.length === 0 ? (
        <p>还没有导入或新建书库。</p>
      ) : (
        <div className="mobile-managed-library-list">
          {libraries.map((item) => (
            <div
              key={item.path}
              className={`mobile-managed-library-row${
                isActive(item) ? " active" : ""
              }`}
            >
              <Button
                type="button"
                className="mobile-managed-library-open"
                onClick={() => onOpen(item.path)}
              >
                <strong>{item.title}</strong>
                {isActive(item) && <span>当前</span>}
              </Button>
              <Button
                type="button"
                className="mobile-managed-library-share"
                aria-label={`分享 ${item.title}`}
                onClick={() => onShare(item)}
              >
                分享
              </Button>
              <Button
                type="button"
                className="mobile-managed-library-export"
                aria-label={`导出 ${item.title}`}
                onClick={() => onExport(item)}
              >
                导出
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}