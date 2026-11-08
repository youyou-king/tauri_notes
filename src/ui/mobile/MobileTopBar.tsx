import type { ReactNode } from "react";
import { IconButton } from "../design-system/Button";
import { Icon } from "../design-system/Icon";

export function MobileTopBar({
  title,
  subtitle,
  canGoBack,
  onBack,
  onMenu,
  actions,
}: {
  title: string;
  subtitle?: string;
  canGoBack: boolean;
  onBack: () => void;
  onMenu: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="mobile-topbar">
      <IconButton
        label="打开导航"
        className="mobile-topbar-button"
        onClick={onMenu}
      >
        <Icon name="menu" />
      </IconButton>
      <div className="mobile-topbar-title">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {actions && <div className="mobile-topbar-actions">{actions}</div>}
      {canGoBack ? (
        <IconButton
          label="返回"
          className="mobile-topbar-button"
          onClick={onBack}
        >
          <Icon name="back" />
        </IconButton>
      ) : (
        <span className="mobile-topbar-spacer" aria-hidden="true" />
      )}
    </header>
  );
}