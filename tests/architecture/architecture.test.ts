import { describe, expect, it } from "vitest";

const sources = normalizeSources(
  import.meta.glob("../../src/plugins/**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);

const editorSources = normalizeSources(
  import.meta.glob("../../src/editor/**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);

const allSources = normalizeSources(
  import.meta.glob("../../src/**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);

function normalizeSources(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([file, source]) => [
      file.replace(/^(?:\.\.\/)+src\//, "").replace(/^\.\//, ""),
      source,
    ]),
  );
}

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

describe("modal surface boundary", () => {
  it("routes dialogs through ModalSurface and never uses native modals", () => {
    const violations: string[] = [];
    for (const [file, source] of Object.entries(allSources)) {
      if (/\.test\.(ts|tsx)$/.test(file)) {
        continue;
      }
      if (/window\.(prompt|alert|confirm)\s*\(/.test(source)) {
        violations.push(`${file} -> native modal`);
      }
      if (
        /role=["']dialog["']/.test(source) &&
        file !== "ui/dialog/ModalSurface.tsx"
      ) {
        violations.push(`${file} -> role=dialog without ModalSurface`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("routes business selects through the shared Select primitive", () => {
    const violations = Object.entries(allSources)
      .filter(
        ([file, source]) =>
          file !== "ui/design-system/Field.tsx" &&
          /<select\b/.test(source),
      )
      .map(([file]) => file);
    expect(violations).toEqual([]);
  });
});

describe("plugin UI boundaries", () => {
  it("features only import shell UI through ui/sdk", () => {
    const violations: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (/\.test\.(ts|tsx)$/.test(file)) {
        continue;
      }
      // This file is the compile-time composition registry, not a feature
      // plugin. It is the one place allowed to import every plugin manifest.
      if (file === "plugins/registry.ts") {
        continue;
      }
      const owner = file.split("/")[1];
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
    const app = import.meta.glob("../../src/App.tsx", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const source = Object.values(app)[0] ?? "";
    expect(source).not.toMatch(/from\s+["']\.\/plugins\//);
  });

  it("editor core does not import feature plugins", () => {
    const violations: string[] = [];
    for (const [file, source] of Object.entries(editorSources)) {
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
  it("plugins use the plugin storage port", () => {
    const violations: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (
        /\.test\.(ts|tsx)$/.test(file) ||
        file.endsWith("plugins/theme/appearanceAssets.ts")
      ) {
        continue;
      }
      if (/window\.(localStorage|sessionStorage)/.test(source)) {
        violations.push(file);
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


describe("runtime composition boundary", () => {
  it("keeps concrete shells out of App", () => {
    const app = allSources["App.tsx"] ?? "";
    expect(app).not.toContain("MobileShell");
    expect(app).not.toContain("AppToolbar");
    expect(app).not.toContain("shell.kind");
  });
});


describe("platform ports", () => {
  it("keeps Tauri dialog access out of UI", () => {
    const violations = Object.entries(allSources)
      .filter(([file]) => file.startsWith("ui/"))
      .filter(([, source]) => source.includes("@tauri-apps/plugin-dialog"))
      .map(([file]) => file);
    expect(violations).toEqual([]);
  });

  it("keeps document mutations out of the mobile shell", () => {
    const shell = allSources["ui/shell/MobileShell.tsx"] ?? "";
    expect(shell).not.toContain("documentService.rename");
    expect(shell).not.toContain("documentService.delete");
  });
});
