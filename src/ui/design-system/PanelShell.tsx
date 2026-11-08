import type { ReactNode } from "react";

export type PanelHeaderProps = {
  title?: ReactNode;
  icon?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
};

export function PanelHeader({
  title,
  icon,
  toolbar,
  className,
}: PanelHeaderProps) {
  if (!title && !toolbar) {
    return null;
  }
  return (
    <header
      className={["panel-shell-header", className].filter(Boolean).join(" ")}
      data-part="panel-header"
    >
      {icon && <span className="panel-shell-icon">{icon}</span>}
      {title && <span className="panel-shell-title">{title}</span>}
      {toolbar && <div className="panel-shell-toolbar">{toolbar}</div>}
    </header>
  );
}

export type PanelShellProps = PanelHeaderProps & {
  status?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
};

/**
 * Common frame for dock panels. Layout only; never owns business state.
 */
export function PanelShell({
  title,
  icon,
  toolbar,
  status,
  children,
  className,
  bodyClassName,
}: PanelShellProps) {
  return (
    <section
      className={["panel-shell", className].filter(Boolean).join(" ")}
      data-part="panel"
    >
      <PanelHeader title={title} icon={icon} toolbar={toolbar} />
      <div
        className={["panel-shell-body", bodyClassName]
          .filter(Boolean)
          .join(" ")}
        data-part="panel-body"
      >
        {children}
      </div>
      {status && (
        <footer className="panel-shell-status" data-part="panel-status">
          {status}
        </footer>
      )}
    </section>
  );
}
