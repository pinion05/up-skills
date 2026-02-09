import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type UpSkillsConfig = {
  baseUrl: string;
  token: string;
};

export type ResolveConfigOptions = {
  homeDir?: string;
  configPath?: string;
  defaultBaseUrl?: string;
};

export function getConfigPath(homeDir: string) {
  return join(homeDir, ".config", "up-skills", "config.json");
}

export function readConfigFile(path: string): Partial<UpSkillsConfig> | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<UpSkillsConfig>;
  if (!parsed || typeof parsed !== "object") return null;
  return parsed;
}

export function writeConfigFile(path: string, cfg: UpSkillsConfig) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

export function resolveConfig(
  env: Record<string, string | undefined>,
  opts: ResolveConfigOptions = {},
): { baseUrl: string; token: string; configPath: string } {
  const homeDir = opts.homeDir ?? env.HOME ?? env.USERPROFILE ?? "";
  if (!homeDir) throw new Error("HOME not set (pass --homeDir)");

  const configPath = opts.configPath ?? getConfigPath(homeDir);
  const fileCfg = readConfigFile(configPath) ?? {};

  const baseUrl =
    env.UP_SKILLS_BASE_URL ??
    (typeof fileCfg.baseUrl === "string" ? fileCfg.baseUrl : undefined) ??
    opts.defaultBaseUrl ??
    "http://127.0.0.1:8787";

  const token =
    env.UP_SKILLS_TOKEN ??
    (typeof fileCfg.token === "string" ? fileCfg.token : undefined) ??
    "";

  if (!token) throw new Error("missing token (set UP_SKILLS_TOKEN or run up-skills init)");

  return { baseUrl, token, configPath };
}

