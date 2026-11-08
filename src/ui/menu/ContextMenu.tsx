import { useEffect, useRef, type KeyboardEvent } from "react";
import { Popover } from "../design-system/Popover";

export type ContextMenuPosition = {
  x: number;
  y: number;
};

export type ContextMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
};

type Props = {
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  onClose: () => void;
  label?: string;
};

/**
 * 全局唯一的上下文菜单：通过 portal 脱离 ReactFlow / Dockview 的
 * transform 容器，统一处理定位、边界收拢、外部点击、Esc 和键盘导航。
 */
export function ContextMenu({
  position,
  items,
  onClose,
  label = "上下文菜单",
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    first?.focus();
  }, []);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const buttons = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? []),
    ];
    if (buttons.length === 0) {
      return;
    }
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next = (current + delta + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  return (
    <Popover
      open
      anchor={{ kind: "point", x: position.x, y: position.y }}
      onClose={onClose}
      className="context-menu"
      ariaLabel={label}
      panelRef={menuRef}
      closeOnViewportChange
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={onMenuKeyDown}
    >
      {items.map((item) => (
        <div key={item.id} role="none">
          {item.separatorBefore && <div className="context-menu-separator" role="separator" />}
          <button
            type="button"
            role="menuitem"
            className={item.danger ? "danger" : undefined}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </Popover>
  );
}