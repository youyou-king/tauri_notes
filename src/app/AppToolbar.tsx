import type { ToolbarItemContribution } from "../kernel/plugin";
import { getCommand } from "../kernel/command";
import { usePluginContributions } from "../ui/plugins/PluginProvider";
import {
  ToolbarButton,
  ToolbarMenu,
} from "../ui/toolbar/ToolbarMenu";
import { CORE_TOOLBAR_ITEMS } from "./coreToolbar";
import { WindowControls } from "../ui/shell/WindowControls";
import { useWindowTitleBarDoubleClick } from "../ui/shell/useWindowTitleBar";
import {
  applyKeymap,
  listActions,
  resolveInputPlatform,
  shortcutForAction,
} from "../kernel/action";
import { useKeymapStore } from "../application/stores/keymapStore";

type Props = {
  busy: boolean;
  hasWorkspace: boolean;
  runCommand: (id: string) => void;
};

type MenuGroup = {
  id: string;
  title: string;
  order: number;
  items: ToolbarItemContribution[];
};

export function AppToolbar({
  busy,
  hasWorkspace,
  runCommand,
}: Props) {
  const pluginItems = usePluginContributions<ToolbarItemContribution>(
    "toolbarItems",
  );
  const items = [...CORE_TOOLBAR_ITEMS, ...pluginItems].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0),
  );
  const keymap = useKeymapStore((state) => state.document);
  const onTitleBarDoubleClick = useWindowTitleBarDoubleClick();
  const platform = resolveInputPlatform();
  const actions = applyKeymap(listActions(), keymap);
  const shortcut = (commandId: string | undefined) =>
    shortcutForAction(
      actions.find((action) => action.id === commandId),
      platform,
    );
  const labelFor = (item: ToolbarItemContribution) =>
    item.commandId
      ? (getCommand(item.commandId)?.label ?? item.label)
      : item.label;

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
    <header
      className="toolbar"
      data-tauri-drag-region
      onDoubleClick={onTitleBarDoubleClick}
    >
      <div className="brand" data-tauri-drag-region>
        <span className="brand-mark">N</span>
        <span>Notes</span>
      </div>
      <div className="toolbar-menus">
        {menuGroups.map((group) => (
          <ToolbarMenu
            key={group.id}
            id={group.id}
            label={group.title}
          >
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={
                  (busy && item.requiresIdle) ||
                  (!hasWorkspace && item.requiresWorkspace)
                }
                title={
                  shortcut(item.commandId)
                    ? `${labelFor(item)} (${shortcut(item.commandId)})`
                    : undefined
                }
                onClick={() => {
                  if (item.commandId) {
                    runCommand(item.commandId);
                  }
                }}
              >
                {labelFor(item)}
              </button>
            ))}
          </ToolbarMenu>
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
            <ToolbarButton
              key={item.id}
              label={labelFor(item)}
              shortcut={shortcut(item.commandId)}
              disabled={busy && item.requiresIdle}
              onClick={() => {
                if (item.commandId) {
                  runCommand(item.commandId);
                }
              }}
            />
          );
        })}
      </div>
      <div className="toolbar-spacer" data-tauri-drag-region />
      <WindowControls />
    </header>
  );
}
