import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { searchService } from "../application/searchService";
import type { SearchHit, WorkspaceView } from "../types";

export default function SearchPalette({
  workspace,
  onClose,
  onOpenHit,
}: {
  workspace: WorkspaceView;
  onClose: () => void;
  onOpenHit: (hit: SearchHit) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setHits([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchService
        .search(workspace.root, text, 30)
        .then((result) => {
          if (!cancelled) {
            setHits(result);
            setActive(0);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(String(err));
            setHits([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, workspace.root]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(hits.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && hits[active]) {
      event.preventDefault();
      onOpenHit(hits[active]);
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-input-row">
          <span className="palette-icon">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`在「${workspace.title}」中搜索…`}
            spellCheck={false}
          />
          <span className="palette-hint">Esc 关闭</span>
        </div>

        <div className="palette-results">
          {loading && <div className="palette-empty">搜索中…</div>}
          {!loading && error && <div className="palette-empty error">{error}</div>}
          {!loading && !error && query.trim() && hits.length === 0 && (
            <div className="palette-empty">没有匹配结果</div>
          )}
          {!loading && !query.trim() && (
            <div className="palette-empty">输入关键词搜索标题和正文</div>
          )}
          {hits.map((hit, index) => (
            <button
              key={`${hit.mapId}:${hit.nodeId}`}
              type="button"
              className={`palette-hit ${index === active ? "active" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => onOpenHit(hit)}
            >
              <div className="palette-hit-title">
                {hit.nodeTitle}
                <span className="palette-hit-map">{hit.mapTitle}</span>
              </div>
              <div className="palette-hit-excerpt">{hit.excerpt}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
