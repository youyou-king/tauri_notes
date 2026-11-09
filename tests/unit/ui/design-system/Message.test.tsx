import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MessageHost,
  message,
} from "../../../../src/ui/design-system/Message";

describe("MessageHost", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows a transient success message and dismisses it", () => {
    vi.useFakeTimers();
    render(<MessageHost />);

    act(() => {
      message.success("已删除 Demo");
    });
    expect(screen.getByRole("status").textContent).toContain("已删除 Demo");

    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
