import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  CUSTOM_THEMES_KEY,
  ThemeProvider,
} from "../../../ui/sdk";
import { ThemeEditor } from "./ThemeEditor";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
});

describe("ThemeEditor", () => {
  it("saves a custom theme and applies it", async () => {
    const onClose = vi.fn();
    render(
      <ThemeProvider>
        <ThemeEditor onClose={onClose} />
      </ThemeProvider>,
    );

    fireEvent.change(screen.getByLabelText("主题名称"), {
      target: { value: "My Theme" },
    });
    fireEvent.click(screen.getByText("保存并应用"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const stored = JSON.parse(
      window.localStorage.getItem(CUSTOM_THEMES_KEY) ?? "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("My Theme");
    expect(stored[0].schema).toBe(1);
    expect(document.documentElement.dataset.themeMode).toBe(
      `custom:${stored[0].id}`,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("rejects an empty theme name", async () => {
    const onClose = vi.fn();
    render(
      <ThemeProvider>
        <ThemeEditor onClose={onClose} />
      </ThemeProvider>,
    );

    fireEvent.change(screen.getByLabelText("主题名称"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("保存并应用"));

    await waitFor(() =>
      expect(screen.getByText(/name 必须/)).toBeTruthy(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
