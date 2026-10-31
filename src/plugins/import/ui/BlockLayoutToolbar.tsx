import type { SelectedBlock } from "../../../application/state/editorSnapshot";

type BlockLayoutToolbarProps = {
  selectedBlock: SelectedBlock;
  onMove: (delta: 1 | -1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUngroup: () => void;
  onUpdateLayout: (patch: Partial<SelectedBlock>) => void;
};

export function BlockLayoutToolbar({
  selectedBlock,
  onMove,
  onDuplicate,
  onDelete,
  onUngroup,
  onUpdateLayout,
}: BlockLayoutToolbarProps) {
  return (
            <div className="block-layout-toolbar">
              <span className="block-layout-label">
                选中块 · {selectedBlock.type}
              </span>
              <button
                type="button"
                className="block-layout-icon-button"
                aria-label="上移块"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onMove(-1)}
              >
                ↑
                <span className="block-layout-tooltip">上移块</span>
              </button>
              <button
                type="button"
                className="block-layout-icon-button"
                aria-label="下移块"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onMove(1)}
              >
                ↓
                <span className="block-layout-tooltip">下移块</span>
              </button>
              <button
                type="button"
                className="block-layout-icon-button"
                aria-label="复制块"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onDuplicate}
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="5.25" y="5.25" width="8.25" height="8.25" rx="1.5" />
                  <path d="M10.75 5.25V3.5a1.5 1.5 0 0 0-1.5-1.5h-6a1.5 1.5 0 0 0-1.5 1.5v6a1.5 1.5 0 0 0 1.5 1.5h1.75" />
                </svg>
                <span className="block-layout-tooltip">复制块</span>
              </button>
              <button
                type="button"
                className="block-layout-icon-button"
                aria-label="删除块"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onDelete}
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.75 4.5h10.5" />
                  <path d="M6.25 4.5V3a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v1.5" />
                  <path d="M4.75 4.5l.5 8a1 1 0 0 0 1 .95h3.5a1 1 0 0 0 1-.95l.5-8" />
                  <path d="M6.75 7v3.75M9.25 7v3.75" />
                </svg>
                <span className="block-layout-tooltip">删除块</span>
              </button>
              {selectedBlock.type === "blockGroup" && (
                <button
                  type="button"
                  title="解组"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onUngroup}
                >
                  解组
                </button>
              )}
              <label>
                宽
                <select
                  value={selectedBlock.span}
                  onChange={(event) =>
                    onUpdateLayout({ span: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (span) => (
                      <option key={span} value={span}>
                        {span} 列
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                高
                <select
                  value={
                    selectedBlock.heightMode === "fixed"
                      ? String(
                          Math.max(1, Math.round(selectedBlock.heightPx / 28)),
                        )
                      : "auto"
                  }
                  onChange={(event) => {
                    if (event.target.value === "auto") {
                      onUpdateLayout({ heightMode: "auto" });
                      return;
                    }
                    onUpdateLayout({
                      heightMode: "fixed",
                      heightPx: Math.max(1, Number(event.target.value)) * 28,
                    });
                  }}
                >
                  <option value="auto">auto</option>
                  {Array.from(
                    new Set([
                      ...Array.from({ length: 48 }, (_, index) => index + 1),
                      ...(selectedBlock.heightMode === "fixed"
                        ? [Math.max(1, Math.round(selectedBlock.heightPx / 28))]
                        : []),
                    ]),
                  )
                    .sort((a, b) => a - b)
                    .map((lines) => (
                      <option key={lines} value={lines}>
                        {lines} 行
                      </option>
                    ))}
                </select>
              </label>
              <label>
                缩放
                <input
                  type="number"
                  min={50}
                  max={200}
                  step={5}
                  value={selectedBlock.zoom}
                  onChange={(event) =>
                    onUpdateLayout({
                      zoom: Math.max(
                        50,
                        Math.min(200, Number(event.target.value)),
                      ),
                    })
                  }
                />
                %
              </label>
            </div>
  );
}
