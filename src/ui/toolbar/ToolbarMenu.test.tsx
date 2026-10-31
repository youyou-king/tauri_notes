import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToolbarMenu } from "./ToolbarMenu";

afterEach(() => cleanup());

function Demo() {
  return (
    <>
      <ToolbarMenu id="first" label="第一">
        <button type="button">第一项</button>
      </ToolbarMenu>
      <ToolbarMenu id="second" label="第二">
        <button type="button">第二项</button>
      </ToolbarMenu>
    </>
  );
}

describe("ToolbarMenu", () => {
  it("closes on outside click and Escape", () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: /第一/ }));
    expect(screen.getByText("第一项")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("第一项")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /第一/ }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("第一项")).toBeNull();
  });

  it("keeps only one toolbar menu open", () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: /第一/ }));
    expect(screen.getByText("第一项")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /第二/ }));
    expect(screen.queryByText("第一项")).toBeNull();
    expect(screen.getByText("第二项")).toBeTruthy();
  });

  it("closes after selecting an item by default", () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: /第一/ }));
    fireEvent.click(screen.getByText("第一项"));
    expect(screen.queryByText("第一项")).toBeNull();
  });
});
