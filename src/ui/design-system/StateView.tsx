import type { ReactNode } from "react";

export function StateView({
  tone = "empty",
  className,
  icon,
  title,
  detail,
  children,
}: {
  tone?: "empty" | "loading" | "error";
  className?: string;
  icon?: ReactNode;
  title?: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={[
        "ui-state",
        `ui-state-${tone}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={tone === "error" ? "alert" : undefined}
    >
      {icon && <span className="ui-state-icon">{icon}</span>}
      {title && <strong className="ui-state-title">{title}</strong>}
      {detail && <p className="ui-state-detail">{detail}</p>}
      {children}
    </div>
  );
}
