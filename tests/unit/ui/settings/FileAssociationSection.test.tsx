import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileAssociationSection } from "../../../../src/ui/settings/FileAssociationSection";

vi.mock("../../../../src/application/associationService", () => ({
  associationService: {
    status: () => Promise.resolve(true),
    register: () => Promise.resolve(),
    unregister: () => Promise.resolve(),
  },
}));

describe("FileAssociationSection", () => {
  it("shows the current .note association state", async () => {
    render(<FileAssociationSection />);

    expect(screen.getByText("文件关联")).toBeTruthy();
    await waitFor(() => {
      expect(
        (screen.getByRole("checkbox") as HTMLInputElement).checked,
      ).toBe(true);
    });
  });
});