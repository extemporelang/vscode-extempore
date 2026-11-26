import { defineConfig } from "@vscode/test-cli";

// EXTEMPORE is an extempore binary with `extempore lsp`; the tests which need
// one are skipped without it.
export default defineConfig({
  files: "out/test/**/*.test.js",
  workspaceFolder: "test/fixtures",
  launchArgs: ["--disable-extensions"],
  mocha: { timeout: 60000 },
});
