import type { MissingLibrary } from "../../application/stores/workspaceStore";

export function MissingLibrariesNotice({
  items,
  onRelocate,
  onForget,
}: {
  items: MissingLibrary[];
  onRelocate: (item: MissingLibrary) => void;
  onForget: (item: MissingLibrary) => void;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="error-banner missing-libraries" role="alert">
      <strong>有 {items.length} 个书库无法打开</strong>
      <ul>
        {items.map((item) => (
          <li key={item.id ?? item.path}>
            <span title={item.path}>{item.path}</span>
            <button type="button" onClick={() => onRelocate(item)}>
              重新定位
            </button>
            <button type="button" onClick={() => onForget(item)}>
              移除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}