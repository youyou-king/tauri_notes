import { describe, expect, it } from "vitest";
import { runMigrations } from "./migrationLedger";

describe("migration ledger", () => {
  it("applies ordered migrations up to the target", () => {
    const result = runMigrations(1, 1, 3, [
      { version: 2, migrate: (value) => value + 10 },
      { version: 3, migrate: (value) => value * 2 },
    ]);
    expect(result).toBe(22);
  });

  it("does not apply old or future steps", () => {
    expect(
      runMigrations("v2", 2, 2, [
        { version: 2, migrate: () => "old" },
      ]),
    ).toBe("v2");
    expect(
      runMigrations("v3", 3, 2, [
        { version: 2, migrate: () => "future" },
      ]),
    ).toBe("v3");
  });
});
