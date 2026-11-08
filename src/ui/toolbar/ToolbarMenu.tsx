import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Popover } from "../design-system/Popover";

const MENU_OPEN_EVENT = "toolbar:menu-open";

export function useToolbarPopover(
  id: string,
  openEvent?: string,
) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(MENU_OPEN_EVENT, { detail: id }),
    );
    setOpen(true);
  }, [id]);
  const toggle = useCallback(() => {
    if (open) {
      close();
    } else {
      show();
    }
  }, [close, open, show]);

  useEffect(() => {
    const handler = (event: Event) => {
      const idFromEvent = (event as CustomEvent<string>).detail;
      if (idFromEvent !== id) {
        close();
      }
    };
    window.addEventListener(MENU_OPEN_EVENT, handler);
    return () => window.removeEventListener(MENU_OPEN_EVENT, handler);
  }, [close, id]);

  useEffect(() => {
    if (!openEvent) {
      return;
    }
    const handler = () => show();
    window.addEventListener(openEvent, handler);
    return () => window.removeEventListener(openEvent, handler);
  }, [openEvent, show]);

  return { ref, open, close, show, toggle };
}

type ToolbarMenuProps = {
  id: string;
  label: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  closeOnSelect?: boolean;
  openEvent?: string;
  disabled?: boolean;
  className?: string;
};

export function ToolbarMenu({
  id,
  label,
  children,
  closeOnSelect = true,
  openEvent,
  disabled = false,
  className,
}: ToolbarMenuProps) {
  const { ref, open, close, toggle } = useToolbarPopover(
    id,
    openEvent,
  );
  const panelId = useId();
  const content =
    typeof children === "function" ? children(close) : children;

  return (
    <div
      className={["toolbar-menu", className].filter(Boolean).join(" ")}
      ref={ref}
    >
      <button
        type="button"
        className={`toolbar-trigger${open ? " active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={disabled}
        onClick={toggle}
      >
        {label}
        <span className="toolbar-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      <Popover
        open={open}
        anchor={{ kind: "element", element: ref.current }}
        onClose={close}
        className="toolbar-popover"
        id={panelId}
        ariaLabel={`${label}菜单`}
        onClick={closeOnSelect ? close : undefined}
      >
        {content}
      </Popover>
    </div>
  );
}

export function ToolbarButton({
  label,
  onClick,
  disabled = false,
  shortcut,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      className="toolbar-trigger"
      title={shortcut ? `${label} (${shortcut})` : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
