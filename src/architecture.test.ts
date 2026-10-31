import { describe, expect, it } from "vitest";

const sources = import.meta.glob("./plugins/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const coreSources = import.meta.glob("./prototype/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const allSources = import.meta.glob("./**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function normalize(file: string, specifier: string): string {
  const parts = file.replace(/^\.\//, "").split("/");
  parts.pop();
  for (const part of specifier.split("/")) {
    if (part === "." || part === "") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

describe("plugin UI boundaries", () => {
  it("features only import shell UI through ui/sdk", () => {
    const violations: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (/\.test\.(ts|tsx)$/.test(file)) {
        continue;
      }
      // This file is the compile-time composition registry, not a feature
      // plugin. It is the one place allowed to import every plugin manifest.
      if (file === "./plugins/registry.ts") {
        continue;
      }
      const owner = file.split("/")[2];
      for (const match of source.matchAll(
        /(?:from\s+|import\()\s*["']([^"']+)["']/g,
      )) {
        const specifier = match[1];
        if (!specifier.startsWith(".")) {
          continue;
        }
        const resolved = normalize(file, specifier);
        const parts = resolved.split("/");
        if (
          parts[0] === "plugins" &&
          parts[1] &&
          parts[1] !== owner
        ) {
          violations.push(`${file} -> ${specifier}`);
        }
        if (
          parts[0] === "ui" &&
          !(parts[1] === "sdk")
        ) {
          violations.push(`${file} -> ${specifier}`);
        }
        if (parts[0] === "components") {
          violations.push(`${file} -> ${specifier}`);
        }
        if (parts[0] === "kernel" && parts[1] !== "sdk") {
          violations.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("features access application services only through pluginServices", () => {
    const forbidden = [
      "application/assetService",
      "application/boardService",
      "application/documentService",
      "application/mapService",
      "infrastructure/tauriReferenceClient",
    ];
    const violations: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (/\.test\.(ts|tsx)$/.test(file)) {
        continue;
      }
      for (const match of source.matchAll(
        /(?:from\s+|import\()\s*["']([^"']+)["']/g,
      )) {
        const specifier = match[1];
        if (!specifier.startsWith(".")) {
          continue;
        }
        const resolved = normalize(file, specifier);
        if (forbidden.some((path) => resolved.startsWith(path))) {
          violations.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("composition root does not import feature plugins", () => {
    const app = import.meta.glob("./App.tsx", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const source = Object.values(app)[0] ?? "";
    expect(source).not.toMatch(/from\s+["']\.\/plugins\//);
  });

  it("editor prototype does not import feature plugins", () => {
    const violations: string[] = [];
    for (const [file, source] of Object.entries(coreSources)) {
      for (const match of source.matchAll(
        /(?:from\s+|import\()\s*["']([^"']+)["']/g,
      )) {
        const specifier = match[1];
        if (!specifier.startsWith(".")) {
          continue;
        }
        const resolved = normalize(file, specifier);
        if (resolved.startsWith("plugins/")) {
          violations.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
  it("app event names live in the typed registry", () => {
    const violations: string[] = [];
    for (const [file, source] of Object.entries(allSources)) {
      if (
        /\.test\.(ts|tsx)$/.test(file) ||
        file.endsWith("kernel/events.ts") ||
        file.endsWith("kernel/event/panelEvents.ts")
      ) {
        continue;
      }
      if (/"tauri-notes:[^"]+"/.test(source)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

});
