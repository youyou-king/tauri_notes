import type {
  ContributionKind,
  PluginContribution,
} from "./contracts";

function text(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function number(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateContribution(
  kind: ContributionKind,
  contribution: PluginContribution,
): string[] {
  const errors: string[] = [];
  if (!text(contribution.id)) {
    errors.push("id 必须是非空字符串");
  }
  switch (kind) {
    case "commands":
      if (!text(contribution.label)) {
        errors.push("命令缺少 label");
      }
      if (
        contribution.shortcut !== undefined &&
        !text(contribution.shortcut)
      ) {
        errors.push("命令 shortcut 必须是非空字符串");
      }
      if (
        contribution.capability !== undefined &&
        !text(contribution.capability)
      ) {
        errors.push("命令 capability 必须是非空字符串");
      }
      break;
    case "panels":
      if (!text(contribution.title)) {
        errors.push("面板缺少 title");
      }
      if (!text(contribution.renderer)) {
        errors.push("面板缺少 renderer");
      }
      break;
    case "overlays":
      if (!text(contribution.renderer)) {
        errors.push("覆盖层缺少 renderer");
      }
      break;
    case "toolbarItems":
      if (!text(contribution.label)) {
        errors.push("工具栏项缺少 label");
      }
      if (
        !contribution.component &&
        !text(contribution.commandId)
      ) {
        errors.push("工具栏项必须提供 component 或 commandId");
      }
      break;
    case "settingsSections":
      if (!text(contribution.title)) {
        errors.push("设置区缺少 title");
      }
      break;
    case "appearancePacks":
      if (!text(contribution.name)) {
        errors.push("外观包缺少 name");
      }
      break;
    case "blockTypes":
      if (!text(contribution.nodeName)) {
        errors.push("块类型缺少 nodeName");
      }
      if (!number(contribution.schemaVersion)) {
        errors.push("块类型缺少 schemaVersion");
      }
      break;
    case "mapNodeTypes":
      if (!text(contribution.nodeType)) {
        errors.push("导图节点类型缺少 nodeType");
      }
      if (!number(contribution.schemaVersion)) {
        errors.push("导图节点类型缺少 schemaVersion");
      }
      break;
    case "contextMenuItems":
      if (!text(contribution.label)) {
        errors.push("右键菜单项缺少 label");
      }
      if (!text(contribution.target)) {
        errors.push("右键菜单项缺少 target");
      }
      break;
    case "migrations":
      if (!number(contribution.version)) {
        errors.push("迁移缺少 version");
      }
      break;
  }
  return errors;
}
