import type { ManagedLibrarySummary } from "../../application/managedLibraryService";

export function MobileManagedLibraries({
  libraries,
  workspaceRoot,
  onOpen,
  onImport,
  onExport,
  onShare,
}: {
  libraries: ManagedLibrarySummary[];
  workspaceRoot: string;
  onOpen: (path: string) => void;
  onImport: () => void;
  onExport: (library: ManagedLibrarySummary) => void;
  onShare: (library: ManagedLibrarySummary) => void;
}) {
  return (
    <section className="mobile-managed-libraries">
      <div className="mobile-managed-header">
        <h2>本机书库</h2>
        <button type="button" onClick={onImport}>
          导入
        </button>
      </div>
      {libraries.length === 0 ? (
        <p>还没有导入或新建书库。</p>
      ) : (
        <div className="mobile-managed-library-list">
          {libraries.map((item) => (
            <div
              key={item.id}
              className={`mobile-managed-library-row${
                workspaceRoot === item.path ? " active" : ""
              }`}
            >
              <button
                type="button"
                className="mobile-managed-library-open"
                onClick={() => onOpen(item.path)}
              >
                <strong>{item.title}</strong>
                {workspaceRoot === item.path && <span>当前</span>}
              </button>
              <button
                type="button"
                className="mobile-managed-library-share"
                aria-label={`分享 ${item.title}`}
                onClick={() => onShare(item)}
              >
                分享
              </button>
              <button
                type="button"
                className="mobile-managed-library-export"
                aria-label={`导出 ${item.title}`}
                onClick={() => onExport(item)}
              >
                导出
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}