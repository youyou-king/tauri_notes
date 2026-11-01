export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
};

export type PromptOptions = {
  title: string;
  defaultValue?: string;
  placeholder?: string;
};

/**
 * Dialog presentation is a platform concern. The application only asks for
 * an answer; desktop can use a modal, mobile can use a sheet.
 */
export type DialogPort = {
  confirm(options: ConfirmOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
  alert(message: string): void;
};