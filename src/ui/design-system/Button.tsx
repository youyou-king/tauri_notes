import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "secondary"
  | "primary"
  | "danger"
  | "ghost"
  | "icon";

export function Button({
  variant = "secondary",
  className,
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children?: ReactNode;
}) {
  const legacy =
    variant === "primary" ? "primary" : variant === "danger" ? "danger" : "";
  return (
    <button
      {...props}
      type={type}
      className={[
        "ui-button",
        `ui-button-${variant}`,
        legacy,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      type={type}
      className={["ui-icon-button", className].filter(Boolean).join(" ")}
      aria-label={label}
      title={props.title ?? label}
    >
      {children}
    </button>
  );
}
