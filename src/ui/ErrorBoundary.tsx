import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { resetDockLayout } from "./dockLayout";
import { recordConsoleEvent } from "../application/consoleLogStore";

const LAST_ERROR_KEY = "tauri-notes.last-render-error";

type Props = {
  children: ReactNode;
  title?: string;
  compact?: boolean;
};

type State = {
  error: Error | null;
};

function describe(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function record(error: Error, info?: ErrorInfo): void {
  console.error("Tauri Notes render error", error, info);
  recordConsoleEvent("system", "界面异常", error.message);
  try {
    window.localStorage.setItem(
      LAST_ERROR_KEY,
      JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: info?.componentStack,
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // Diagnostics must never take down the recovery screen.
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: describe(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    record(error, info);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  private resetLayout = (): void => {
    resetDockLayout();
    window.location.reload();
  };

  private copyDiagnostics = (): void => {
    const error = this.state.error;
    if (!error) {
      return;
    }
    void navigator.clipboard
      ?.writeText(JSON.stringify({ message: error.message, stack: error.stack }, null, 2))
      .catch(() => {});
  };

  render(): ReactNode {
    const error = this.state.error;
    if (!error) {
      return this.props.children;
    }
    const compact = this.props.compact === true;
    return (
      <div className={compact ? "error-boundary error-boundary--panel" : "error-boundary"}>
        <div className="error-boundary-card">
          <div className="error-boundary-mark" aria-hidden="true">
            !
          </div>
          <h2>{this.props.title ?? "界面加载失败"}</h2>
          <p>
            这个区域没有加载成功。笔记数据不会因此被删除，可以先重试或重新加载界面。
          </p>
          <pre>{error.message}</pre>
          <div className="error-boundary-actions">
            <button type="button" className="primary" onClick={this.retry}>
              重试
            </button>
            <button type="button" onClick={this.reload}>
              重新加载
            </button>
            <button type="button" onClick={this.resetLayout}>
              重置布局并重新加载
            </button>
            <button type="button" onClick={this.copyDiagnostics}>
              复制诊断
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export function PanelErrorBoundary({
  panelId,
  children,
}: {
  panelId: string;
  children?: ReactNode;
}) {
  return (
    <ErrorBoundary compact title={`面板加载失败：${panelId}`}>
      {children}
    </ErrorBoundary>
  );
}
