import type { Dispatch, SetStateAction } from "react";
import type { ToolbarItemContribution } from "../kernel/plugin";
import { usePluginContributions } from "../ui/plugins/PluginProvider";
import { CORE_TOOLBAR_ITEMS } from "./coreToolbar";

export type NavbarMenu = string | null;

type Props = {
  backend: string;
  busy: boolean;
  hasWorkspace: boolean;
  menu: NavbarMenu;
  setMenu: Dispatch<SetStateAction<NavbarMenu>>;
  runCommand: (id: string) => void;
};

type MenuGroup = {
  id: string;
  title: string;
  order: number;
  items: ToolbarItemContribution[];
};

export function AppToolbar({
  backend,
  busy,
  hasWorkspace,
  menu,
  setMenu,
  runCommand,
}: Props) {
  const pluginItems = usePluginContributions<ToolbarItemContribution>(
    "toolbarItems",
  );
  const items = [...CORE_TOOLBAR_ITEMS, ...pluginItems].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0),
  );

  const groups = new Map<string, MenuGroup>();
  const directItems: ToolbarItemContribution[] = [];
  for (const item of items) {
    if (!item.menu) {
      directItems.push(item);
      continue;
    }
    const group = groups.get(item.menu) ?? {
      id: item.menu,
      title: item.menuTitle ?? item.menu,
      order: item.menuOrder ?? 100,
      items: [],
    };
    group.order = Math.min(group.order, item.menuOrder ?? group.order);
    group.items.push(item);
    groups.set(item.menu, group);
  }
  const menuGroups = [...groups.values()].sort(
    (left, right) => left.order - right.order,
  );

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">N</span>
        <span>Notes</span>
      </div>
      <div className="toolbar-menus">
        {menuGroups.map((group) => (
          <div className="toolbar-menu" key={group.id}>
            <button
              type="button"
              className={menu === group.id ? "active" : ""}
              onClick={() =>
                setMenu((current) =>
                  current === group.id ? null : group.id,
                )
              }
            >
              {group.title} ▾
            </button>
            {menu === group.id && (
              <div className="toolbar-popover">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={
                      (busy && item.requiresIdle) ||
                      (!hasWorkspace && item.requiresWorkspace)
                    }
                    onClick={() => {
                      setMenu(null);
                      if (item.commandId) {
                        runCommand(item.commandId);
                      }
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {directItems.map((item) => {
          const Component = item.component;
          if (Component) {
            return <Component key={item.id} />;
          }
          if (!item.commandId) {
            return null;
          }
          return (
            <button
              key={item.id}
              type="button"
              className="toolbar-help"
              disabled={busy && item.requiresIdle}
              onClick={() => {
                setMenu(null);
                if (item.commandId) {
                  runCommand(item.commandId);
                }
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        className={`backend ${
          backend.startsWith("未") ? "offline" : "online"
        }`}
      >
        {backend}
      </div>
    </header>
  );
}
