import type { ReactNode } from "react";

export type PanelShellProps = {
  title?: ReactNode;
  icon?: ReactNode;
  toolbar?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
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
      {(title || toolbar) && (
        <header className="panel-shell-header" data-part="panel-header">
          {icon && <span className="panel-shell-icon">{icon}</span>}
          {title && <span className="panel-shell-title">{title}</span>}
          {toolbar && <div className="panel-shell-toolbar">{toolbar}</div>}
        </header>
      )}
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
