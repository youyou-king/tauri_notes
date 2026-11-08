import { Icon, type IconName } from "./Icon";

const PANEL_ICONS: Record<string, IconName> = {
  "🗂": "outline",
  "🌳": "map",
  "⌨": "console",
  "📚": "library",
  "📄": "document",
  "🧩": "board",
  "💡": "idea",
  "▦": "board",
};

export function PanelIcon({
  icon,
  size = 14,
}: {
  icon: string;
  size?: number;
}) {
  const name = PANEL_ICONS[icon];
  return name ? <Icon name={name} size={size} /> : <span>{icon}</span>;
}
