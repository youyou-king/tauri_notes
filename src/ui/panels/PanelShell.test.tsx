import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PanelShell } from "./PanelShell";

describe("PanelShell", () => {
  it("renders stable theme parts and slots", () => {
    const { container } = render(
      <PanelShell
        title="文档库"
        icon="📚"
        status="3 个文档"
        toolbar={<button type="button">刷新</button>}
      >
        <div>内容</div>
      </PanelShell>,
    );

    expect(screen.getByText("文档库")).toBeTruthy();
    expect(screen.getByText("刷新")).toBeTruthy();
    expect(screen.getByText("内容")).toBeTruthy();
    expect(screen.getByText("3 个文档")).toBeTruthy();
    expect(
      container.querySelector('[data-part="panel"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-part="panel-header"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-part="panel-body"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-part="panel-status"]'),
    ).toBeTruthy();
  });

  it("can render content without a header", () => {
    const { container } = render(
      <PanelShell>
        <div>仅内容</div>
      </PanelShell>,
    );
    expect(screen.getByText("仅内容")).toBeTruthy();
    expect(
      container.querySelector('[data-part="panel-header"]'),
    ).toBeNull();
  });
});
