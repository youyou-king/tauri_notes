import { beforeEach, describe, expect, it } from "vitest";
import { useMobileShellStore } from "../../../../src/application/stores/mobileShellStore";
import { createDesktopNavigation, createMobileNavigation } from "../../../../src/runtime/services/navigation";

describe("navigation port", () => {
  beforeEach(() => {
    useMobileShellStore.getState().reset();
  });

  it("uses the mobile back stack", () => {
    const navigation = createMobileNavigation();
    navigation.openDocument("doc-1");
    expect(useMobileShellStore.getState().views[0]).toMatchObject({
      kind: "document",
      documentId: "doc-1",
    });
    expect(navigation.canGoBack()).toBe(true);
    expect(navigation.back()).toBe(true);
    expect(useMobileShellStore.getState().views[0]).toMatchObject({
      kind: "map",
      documentId: null,
    });
  });

  it("keeps desktop navigation as a safe no-op", () => {
    const navigation = createDesktopNavigation();
    expect(navigation.back()).toBe(false);
    expect(navigation.canGoBack()).toBe(false);
    expect(() => navigation.openDocument("doc-1")).not.toThrow();
  });
});