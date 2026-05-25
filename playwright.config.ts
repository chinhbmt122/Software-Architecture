import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"
import path from "path"
import { AUTH_FILE } from "./tests/constants"

// Load infra config (.env.local) first so DATABASE_URL etc are set from the real values,
// then .env.test for test-only vars (TEST_USER_EMAIL/PASSWORD). dotenv never overrides
// already-set keys, so .env.local values win for anything defined in both files.
dotenv.config({ path: path.resolve(__dirname, ".env.local") })
dotenv.config({ path: path.resolve(__dirname, ".env.test") })

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/global.setup.ts",
    },
    {
      name: "api",
      testMatch: "**/api/**/*.spec.ts",
      dependencies: ["setup"],
      use: { storageState: AUTH_FILE },
    },
    {
      name: "e2e",
      testMatch: "**/e2e/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
