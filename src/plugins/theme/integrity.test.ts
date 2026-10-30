import { describe, expect, it } from "vitest";
import { isSha256Integrity, sha256Base64 } from "./integrity";

describe("appearance integrity", () => {
  it("computes a SHA-256 integrity value", async () => {
    const bytes = new TextEncoder().encode("abc");
    await expect(sha256Base64(bytes)).resolves.toBe(
      "sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=",
    );
  });

  it("validates the integrity format", () => {
    expect(
      isSha256Integrity(
        "sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=",
      ),
    ).toBe(true);
    expect(isSha256Integrity("sha256-nope")).toBe(false);
    expect(isSha256Integrity(42)).toBe(false);
  });
});
