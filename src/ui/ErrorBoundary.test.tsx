import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function BrokenPanel(): never {
  throw new Error("panel exploded");
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders a recovery screen instead of a blank application", () => {
    render(
      <ErrorBoundary>
        <BrokenPanel />
      </ErrorBoundary>,
    );

    expect(screen.getByText("界面加载失败")).toBeTruthy();
    expect(screen.getByText("panel exploded")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "重置布局并重新加载" }),
    ).toBeTruthy();
  });

  it("can retry the failed subtree", () => {
    let shouldThrow = true;
    function SometimesBroken() {
      if (shouldThrow) {
        throw new Error("temporary");
      }
      return <div>recovered</div>;
    }

    render(
      <ErrorBoundary>
        <SometimesBroken />
      </ErrorBoundary>,
    );
    expect(screen.getByText("temporary")).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.getByText("recovered")).toBeTruthy();
  });
});
