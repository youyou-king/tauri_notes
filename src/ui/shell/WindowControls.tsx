import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconButton } from "../design-system/Button";
import { Icon } from "../design-system/Icon";

async function currentWindow() {
  return getCurrentWindow();
}

/**
 * Desktop-only custom window controls. All Tauri window access stays in the
 * shell layer; the rest of the UI only renders the toolbar.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let window: ReturnType<typeof getCurrentWindow>;
    try {
      window = getCurrentWindow();
    } catch {
      return;
    }
    const sync = () => {
      void window.isMaximized().then(
        (value) => {
          if (!disposed) {
            setMaximized(value);
          }
        },
        () => {},
      );
    };
    sync();
    void window.onResized(sync).then(
      (off) => {
        if (disposed) {
          off();
        } else {
          unlisten = off;
        }
      },
      () => {},
    );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const run = (action: () => Promise<void>) => {
    void action().catch(() => {});
  };

  return (
    <div className="window-controls">
      <IconButton
        label="最小化"
        className="window-control"
        onClick={() => run(async () => (await currentWindow()).minimize())}
      >
        <Icon name="minimize" size={12} />
      </IconButton>
      <IconButton
        label={maximized ? "还原" : "最大化"}
        className="window-control"
        onClick={() =>
          run(async () => (await currentWindow()).toggleMaximize())
        }
      >
        <Icon name={maximized ? "restore" : "maximize"} size={12} />
      </IconButton>
      <IconButton
        label="关闭"
        className="window-control close"
        onClick={() => run(async () => (await currentWindow()).close())}
      >
        <Icon name="close" size={12} />
      </IconButton>
    </div>
  );
}