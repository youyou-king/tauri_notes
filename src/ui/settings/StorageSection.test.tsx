import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StorageSection } from "./StorageSection";

describe("StorageSection", () => {
  it("asks for an active workspace", () => {
    render(<StorageSection />);
    expect(screen.getByText("先打开一个知识库。")).toBeTruthy();
  });
});
