import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:1420",
    channel: "msedge",
    headless: true,
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420/e2e.html",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
