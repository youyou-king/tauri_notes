import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionDefinition } from "../../kernel/action";
import { MobileDocumentActionSheet } from "./MobileDocumentActionSheet";

const actions = [
  { id: "document.open", title: "打开文档" },
  { id: "document.rename", title: "重命名文档" },
  { id: "document.delete", title: "移到回收站" },
] as ActionDefinition[];

afterEach(cleanup);

describe("MobileDocumentActionSheet", () => {
  it("renders actions and forwards the selected document", () => {
    const onAction = vi.fn();
    const document = { id: "map/doc", title: "Demo" };
    render(
      <MobileDocumentActionSheet
        document={document}
        actions={actions}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );
    expect(screen.getByText("Demo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "移到回收站" }));
    expect(onAction).toHaveBeenCalledWith("document.delete", document);
  });
});