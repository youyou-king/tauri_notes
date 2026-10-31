import { describe, expect, it } from "vitest";

const workflowFiles = import.meta.glob(
  "../.github/workflows/release.yml",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const capabilityFiles = import.meta.glob(
  "../src-tauri/capabilities/*.json",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const configFiles = import.meta.glob("../src-tauri/tauri.conf.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function read(files: Record<string, string>): string {
  return Object.values(files)[0] ?? "";
}

describe("release readiness", () => {
  it("publishes all platforms from a version tag", () => {
    const workflow = read(workflowFiles);
    expect(workflow).toMatch(/tags:\s*\n\s*- "v\*"/);
    expect(workflow).toContain("npm run version:check");
    expect(workflow).toContain("Tauri Notes Setup.exe");
    expect(workflow).toContain("bundle/dmg/*.dmg");
    expect(workflow).toContain("bundle/appimage/*.AppImage");
    expect(workflow).toContain("bundle/deb/*.deb");
    expect(workflow).toContain("contents: write");
  });

  it("keeps the Tauri bundle and CSP explicit", () => {
    const config = JSON.parse(read(configFiles)) as {
      app: { security: { csp: unknown; assetProtocol: { scope: unknown[] } } };
      bundle: { targets: string };
    };
    expect(config.bundle.targets).toBe("all");
    expect(config.app.security.csp).toBeTruthy();
    expect(config.app.security.assetProtocol.scope).toEqual([]);
  });
  it("scopes capabilities to explicit windows", () => {
    const capabilities = Object.values(capabilityFiles).map(
      (raw) =>
        JSON.parse(raw) as {
          identifier: string;
          windows: string[];
          permissions: string[];
        },
    );
    expect(capabilities.length).toBeGreaterThan(0);
    expect(new Set(capabilities.map((item) => item.identifier)).size).toBe(
      capabilities.length,
    );
    for (const capability of capabilities) {
      expect(capability.windows.length).toBeGreaterThan(0);
      expect(capability.windows).not.toContain("*");
      expect(capability.permissions.length).toBeGreaterThan(0);
    }
  });

});
