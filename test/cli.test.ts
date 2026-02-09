import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getConfigPath, resolveConfig } from "../src/cli/config";

describe("CLI config", () => {
  test("defaults to ~/.config/up-skills/config.json", () => {
    expect(getConfigPath("/home/u")).toBe("/home/u/.config/up-skills/config.json");
  });

  test("env overrides config file", () => {
    const home = mkdtempSync(join(tmpdir(), "up-skills-home-"));
    const configPath = getConfigPath(home);
    // Ensure parent dir exists.
    const configDir = join(home, ".config", "up-skills");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({ baseUrl: "http://from-file", token: "file-token" }),
      "utf8",
    );

    const cfg = resolveConfig(
      { UP_SKILLS_BASE_URL: "http://from-env", UP_SKILLS_TOKEN: "env-token" },
      { homeDir: home },
    );
    expect(cfg.baseUrl).toBe("http://from-env");
    expect(cfg.token).toBe("env-token");
  });
});
