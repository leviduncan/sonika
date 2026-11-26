import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * Landing fidelity and behavior checks. The app under test is a production
 * build, because dev mode injects overlays and changes timing. Set
 * PW_REUSE_SERVER=1 to point at a server you already started on port 3100.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    colorScheme: "light",
    deviceScaleFactor: 1,
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: Boolean(process.env.PW_REUSE_SERVER),
    timeout: 240_000,
  },
});
