import type { ConfirmOptions, PromptOptions } from "../../application/ports/dialogPort";

type DialogButton = {
  label: string;
  value: string | boolean | null;
  tone?: "default" | "danger";
};

function createDialogElement() {
  const backdrop = document.createElement("div");
  backdrop.className = "mobile-dialog-backdrop";
  const panel = document.createElement("div");
  panel.className = "mobile-dialog";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  backdrop.append(panel);
  document.body.append(backdrop);
  return { backdrop, panel };
}

function createMessage(panel: HTMLElement, title: string, message?: string) {
  const heading = document.createElement("h2");
  heading.className = "mobile-dialog-title";
  heading.textContent = title;
  panel.append(heading);
  if (message) {
    const body = document.createElement("p");
    body.className = "mobile-dialog-message";
    body.textContent = message;
    panel.append(body);
  }
}

function createActions(
  panel: HTMLElement,
  buttons: DialogButton[],
  finish: (value: string | boolean | null) => void,
) {
  const actions = document.createElement("div");
  actions.className = "mobile-dialog-actions";
  for (const button of buttons) {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = button.label;
    if (button.tone === "danger") {
      element.className = "danger";
    }
    element.addEventListener("click", () => finish(button.value));
    actions.append(element);
  }
  panel.append(actions);
}

function close(backdrop: HTMLElement) {
  backdrop.remove();
}

export function createMobileConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const { backdrop, panel } = createDialogElement();
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      close(backdrop);
      resolve(value);
    };
    createMessage(panel, options.title, options.message);
    createActions(
      panel,
      [
        { label: "取消", value: false },
        {
          label: options.confirmLabel ?? "确定",
          value: true,
          tone: options.tone === "danger" ? "danger" : "default",
        },
      ],
      (value) => finish(value === true),
    );
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(false);
    });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") finish(false);
    });
    backdrop.tabIndex = -1;
    backdrop.focus();
  });
}

export function createMobilePrompt(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const { backdrop, panel } = createDialogElement();
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      close(backdrop);
      resolve(value);
    };
    createMessage(panel, options.title);
    const input = document.createElement("input");
    input.className = "mobile-dialog-input";
    input.type = "text";
    input.value = options.defaultValue ?? "";
    input.placeholder = options.placeholder ?? "";
    panel.append(input);
    createActions(
      panel,
      [
        { label: "取消", value: null },
        { label: "确定", value: "confirm" },
      ],
      (value) => finish(value === null ? null : input.value),
    );
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(input.value);
      }
      if (event.key === "Escape") finish(null);
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(null);
    });
    backdrop.tabIndex = -1;
    input.focus();
    input.select();
  });
}

export function createMobileAlert(message: string): void {
  const { backdrop, panel } = createDialogElement();
  createMessage(panel, "提示", message);
  createActions(
    panel,
    [{ label: "确定", value: true }],
    () => close(backdrop),
  );
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close(backdrop);
  });
  backdrop.tabIndex = -1;
  backdrop.focus();
}