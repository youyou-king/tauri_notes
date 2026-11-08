import type { ToolbarItemContribution } from "../kernel/plugin";
import { COMMAND_LABELS, NAV_LABELS } from "./commandLabels";

/**
 * Shell-owned toolbar composition. These are data, not JSX branches in the
 * toolbar, so the shell and plugin contributions share one render path.
 */
export const CORE_TOOLBAR_ITEMS: ToolbarItemContribution[] = [
  {
    id: "knowledge.create",
    label: COMMAND_LABELS["knowledge.create"],
    menu: "knowledge",
    menuTitle: NAV_LABELS.knowledge,
    menuOrder: 10,
    order: 10,
    commandId: "knowledge.create",
    requiresIdle: true,
  },
  {
    id: "knowledge.open",
    label: COMMAND_LABELS["knowledge.open"],
    menu: "knowledge",
    menuTitle: NAV_LABELS.knowledge,
    menuOrder: 10,
    order: 20,
    commandId: "knowledge.open",
    requiresIdle: true,
  },
  {
    id: "knowledge.backup",
    label: COMMAND_LABELS["knowledge.backup"],
    menu: "knowledge",
    menuTitle: NAV_LABELS.knowledge,
    menuOrder: 10,
    order: 30,
    commandId: "knowledge.backup",
    requiresIdle: true,
    requiresWorkspace: true,
  },
  {
    id: "view.outline",
    label: COMMAND_LABELS["view.outline"],
    menu: "view",
    menuTitle: NAV_LABELS.view,
    menuOrder: 20,
    order: 10,
    commandId: "view.outline",
  },
  {
    id: "view.console",
    label: COMMAND_LABELS["view.console"],
    menu: "view",
    menuTitle: NAV_LABELS.view,
    menuOrder: 20,
    order: 20,
    commandId: "view.console",
  },
  {
    id: "view.clear-layout",
    label: COMMAND_LABELS["view.clear-layout"],
    menu: "view",
    menuTitle: NAV_LABELS.view,
    menuOrder: 20,
    order: 30,
    commandId: "view.clear-layout",
  },
  {
    id: "settings.open",
    label: COMMAND_LABELS["settings.open"],
    order: 90,
    commandId: "settings.open",
  },
];