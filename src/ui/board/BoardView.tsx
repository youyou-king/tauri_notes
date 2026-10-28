import { useEffect, useMemo, useRef, useState } from "react";
import {
  availableZooms,
  type BoardController,
} from "./useBoardController";
import type { BoardViewport } from "../../domain/board";
import type { ReferenceState, ResolvedBlock } from "../../domain/reference";
import { packColumns, type PackedCard } from "../../domain/packer";
import { asBoardItemId } from "../../domain/ids";
import MarkdownPreview from "./MarkdownPreview";
import { renderBlockHtml } from "../../editor/blockHtml";

function BlockBody({ block }: { block: ResolvedBlock | null }) {
  const html = useMemo(
    () =>
      block?.contentJson
        ? renderBlockHtml(block.contentJson, block.blockType ?? block.blockTitle)
        : "",
    [block],
  );
  if (html) {
    return (
      <div
        className="board-rich-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <MarkdownPreview markdown={block?.markdown ?? ""} />;
}

function ViewportCard({
  item,
  index,
  position,
  state,
  onZoom,
  onSpan,
  onHeight,
  onRemove,
  onDropItem,
  onOpenSource,
  sources,
  onRelink,
  targetDocId,
}: {
  item: BoardViewport;
  index: number;
  position: PackedCard;
  state: ReferenceState | undefined;
  onZoom: (zoom: number) => void;
  onSpan: (span: number) => void;
  onHeight: (height: number) => void;
  onRemove: () => void;
  onDropItem: (itemId: string, targetIndex: number) => void;
  onOpenSource: (docId: string) => void;
  sources: ResolvedBlock[];
  onRelink: (source: ResolvedBlock) => void;
  targetDocId: string | null;
}) {
  const [height, setHeight] = useState(position.height);
  const [selectedSource, setSelectedSource] = useState("");
  const dragRef = useRef<{
    y: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setHeight(position.height);
  }, [position.height]);

  const resolved =
    state?.status === "resolved" || state?.status === "changed"
      ? state.block
      : null;
  const title = resolved?.blockTitle ?? item.reference.lastTitle;

  return (
    <article
      className={`board-card ${state?.status === "missing" ? "missing" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        width: position.width,
        height,
      }}
      data-board-item={item.id}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const source = event.dataTransfer.getData("application/x-board-item");
        if (source && source !== item.id) {
          onDropItem(source, index);
        }
      }}
    >
      <header
        className="board-card-header"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("application/x-board-item", item.id);
          event.dataTransfer.setData(
            "application/x-notes-embed",
            `<!-- notes:embed=${item.reference.blockId};span=${item.span};height=${item.height};zoom=${item.zoom};width=60 -->`,
          );
          event.dataTransfer.effectAllowed = "copyMove";
        }}
      >
        <span
          className="board-drag-grip"
          title="拖动排序；拖到文档中插入引用卡"
        >
          ⠿
        </span>
        <span className="board-card-title" title={title}>
          {title}
        </span>
        <button
          type="button"
          className="board-card-source"
          title="打开源文档"
          onClick={() => onOpenSource(resolved?.docId ?? item.reference.lastDocId)}
        >
          {item.reference.lastTitle} ↗
        </button>
        <div className="board-card-actions">
          <button type="button" onClick={() => onSpan(item.span - 1)} title="减少列跨度">
            −列
          </button>
          <span className="board-zoom">{item.span}列</span>
          <button type="button" onClick={() => onSpan(item.span + 1)} title="增加列跨度">
            +列
          </button>
          <button type="button" onClick={() => onZoom(item.zoom - 0.25)} title="缩小">
            A−
          </button>
          <span className="board-zoom">{Math.round(item.zoom * 100)}%</span>
          <button type="button" onClick={() => onZoom(item.zoom + 0.25)} title="放大">
            A+
          </button>
          <button
            type="button"
            title="把这张引用卡插入当前文档"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("tauri-notes:insert-embed", {
                  detail: {
                    docId: targetDocId ?? item.reference.lastDocId,
                    marker: `<!-- notes:embed=${item.reference.blockId};span=${item.span};height=${item.height};zoom=${item.zoom};width=60 -->`,
                  },
                }),
              );
            }}
          >
            插入文章
          </button>
          <button type="button" onClick={onRemove} title="删除引用">
            ×
          </button>
        </div>
      </header>
      <div
        className="board-card-body"
        style={{ fontSize: `${16 * item.zoom}px`, lineHeight: 1.8 }}
      >
        {state?.status === "missing" ? (
          <div className="board-card-missing">
            <p>来源已失效：{item.reference.lastDocId}</p>
            <select
              value={selectedSource}
              onChange={(event) => setSelectedSource(event.target.value)}
            >
              <option value="">选择新的来源块</option>
              {sources.map((source) => (
                <option key={source.blockId} value={source.blockId}>
                  {source.docTitle} / {source.blockTitle}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const source = sources.find(
                  (candidate) => candidate.blockId === selectedSource,
                );
                if (source) {
                  onRelink(source);
                }
              }}
              disabled={!selectedSource}
            >
              重新关联
            </button>
          </div>
        ) : state?.status === "changed" ? (
          <>
            <p className="board-card-warning">来源内容已变化。</p>
            <BlockBody block={resolved} />
          </>
        ) : resolved ? (
          <BlockBody block={resolved} />
        ) : (
          <p>加载中…</p>
        )}
      </div>
      <button
        type="button"
        className="board-resize-handle"
        title="调整窗口大小"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { y: event.clientY, height };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) {
            return;
          }
          setHeight(Math.max(180, drag.height + event.clientY - drag.y));
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag) {
            return;
          }
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          const nextHeight = Math.max(180, drag.height + event.clientY - drag.y);
          setHeight(nextHeight);
          onHeight(nextHeight);
        }}
      />
    </article>
  );
}

export default function BoardView({
  controller,
  onOpenSource,
  onClose,
  targetDocId,
}: {
  controller: BoardController;
  onOpenSource: (docId: string) => void;
  onClose: () => void;
  targetDocId: string | null;
}) {
  const cardsRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [pickedSource, setPickedSource] = useState("");

  useEffect(() => {
    const element = cardsRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) {
        setContainerWidth(width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const items = controller.board?.items ?? [];
  const packed = packColumns(
    items.map((item) => ({
      id: item.id,
      span: item.span,
      height: item.height,
    })),
    containerWidth,
    { minColumnWidth: 420, maxColumns: 3, gap: 16 },
  );
  const positions = new Map(packed.cards.map((card) => [card.id, card]));
  const zooms = availableZooms();

  return (
    <section className="board-window board-panel">
        <header className="board-header">
          <div>
            <h2>{controller.board?.title ?? "对照板"}</h2>
            <p>
              {items.length} 张引用卡片 · {packed.columnCount} 列
            </p>
          </div>
          <div className="board-header-actions">
            <select
              className="board-source-picker"
              value={pickedSource}
              onChange={(event) => setPickedSource(event.target.value)}
              title="从已索引的文档块中添加引用"
            >
              <option value="">选择文档块…</option>
              {controller.sources.map((source) => (
                <option key={source.blockId} value={source.blockId}>
                  {source.docTitle} / {source.blockTitle}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="board-add-source"
              disabled={!pickedSource}
              onClick={() => {
                const source = controller.sources.find(
                  (candidate) => candidate.blockId === pickedSource,
                );
                if (source) {
                  void controller.addSource(source);
                  setPickedSource("");
                }
              }}
            >
              + 添加引用
            </button>
            <button type="button" className="board-close" onClick={onClose}>
              关闭
            </button>
          </div>
        </header>

        <div className="board-body">
          {controller.error && <div className="error-banner">{controller.error}</div>}
          {controller.loading && <div className="board-empty">加载中…</div>}
          {!controller.loading && items.length === 0 && (
            <div className="board-empty">
              在文档中选中内容，点击“固定到对照板”。
            </div>
          )}

          <div ref={cardsRef} className="board-cards">
            <div
              className="board-canvas"
              style={{ height: Math.max(packed.height, 1) }}
            >
              {items.map((item, index) => {
                const position = positions.get(item.id);
                if (!position) {
                  return null;
                }
                return (
                  <ViewportCard
                    key={item.id}
                    item={item}
                    index={index}
                    position={position}
                    state={controller.states[item.id]}
                    sources={controller.sources}
                    targetDocId={targetDocId}
                    onRelink={(source) => controller.relinkItem(item.id, source)}
                    onZoom={(zoom) => {
                      const nearest = zooms.reduce((current, level) =>
                        Math.abs(level - zoom) < Math.abs(current - zoom)
                          ? level
                          : current,
                      );
                      controller.setZoom(item.id, nearest);
                    }}
                    onSpan={(span) => controller.setSpan(item.id, span)}
                    onHeight={(height) => controller.setHeight(item.id, height)}
                    onDropItem={(source, targetIndex) =>
                      controller.moveItem(asBoardItemId(source), targetIndex)
                    }
                    onOpenSource={onOpenSource}
                    onRemove={() => controller.removeItem(item.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
    </section>
  );
}
