import { useEffect, useRef } from "react";
import {
  useConsoleLogStore,
  type ConsoleCategory,
} from "../../application/consoleLogStore";
import { PanelShell } from "./PanelShell";

const CATEGORY_LABELS: Record<ConsoleCategory, string> = {
  command: "命令",
  workspace: "知识库",
  panel: "面板",
  document: "文档",
  theme: "主题",
  action: "操作",
  system: "系统",
};

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ConsolePanel() {
  const events = useConsoleLogStore((state) => state.events);
  const clear = useConsoleLogStore((state) => state.clear);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [events.length]);

  const copy = () => {
    const text = events
      .map(
        (event) =>
          `${formatTime(event.at)} [${CATEGORY_LABELS[event.category]}] ${event.action}${event.detail ? ` — ${event.detail}` : ""}`,
      )
      .join("\n");
    const clipboard = navigator.clipboard;
    if (clipboard) {
      void clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <PanelShell
      className="console-panel"
      bodyClassName="console-body"
      title="控制台"
      icon="⌨"
      status={`${events.length} 条记录`}
      toolbar={
        <>
          <button type="button" onClick={copy} disabled={events.length === 0}>
            复制
          </button>
          <button type="button" onClick={clear} disabled={events.length === 0}>
            清空
          </button>
        </>
      }
    >
      <div className="console-events" aria-live="polite">
        {events.length === 0 ? (
          <div className="console-empty">
            暂无操作记录。打开知识库、切换面板、执行命令和修改主题都会记录在这里。
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="console-event"
              data-category={event.category}
            >
              <time
                className="console-time"
                dateTime={new Date(event.at).toISOString()}
              >
                {formatTime(event.at)}
              </time>
              <span className="console-category">
                {CATEGORY_LABELS[event.category]}
              </span>
              <span className="console-action">{event.action}</span>
              {event.detail && (
                <span className="console-detail">{event.detail}</span>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </PanelShell>
  );
}
