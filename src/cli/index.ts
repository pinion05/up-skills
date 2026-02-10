import { writeConfigFile } from "./config";
import { resolveConfig } from "./config";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

type ParsedArgs =
  | { command: "init"; baseUrl?: string; homeDir?: string }
  | { command: "list" }
  | { command: "search"; q: string }
  | { command: "add"; sourceUrl: string; alias?: string }
  | { command: "get"; id: string; json: boolean }
  | { command: "remove"; id: string }
  | { command: "help" };

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function takeFlagValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  const v = argv[idx + 1];
  if (!v || v.startsWith("--")) die(`missing value for ${flag}`);
  argv.splice(idx, 2);
  return v;
}

function hasFlag(argv: string[], flag: string): boolean {
  const idx = argv.indexOf(flag);
  if (idx === -1) return false;
  argv.splice(idx, 1);
  return true;
}

export function parseArgs(argv0: string[]): ParsedArgs {
  const argv = [...argv0];
  const cmd = argv.shift();
  if (!cmd) return { command: "help" };

  if (cmd === "get") {
    const json = hasFlag(argv, "--json");
    const id = argv.shift();
    if (!id) die("usage: up-skills get <id> [--json]");
    return { command: "get", id, json };
  }

  if (cmd === "add") {
    const sourceUrl = argv.shift();
    if (!sourceUrl) die("usage: up-skills add <raw-skill-md-url> [--alias <name>]");
    const alias = takeFlagValue(argv, "--alias");
    return { command: "add", sourceUrl, ...(alias ? { alias } : {}) };
  }

  if (cmd === "list") return { command: "list" };

  if (cmd === "search") {
    const q = argv.join(" ").trim();
    if (!q) die("usage: up-skills search <query>");
    return { command: "search", q };
  }

  if (cmd === "remove") {
    const id = argv.shift();
    if (!id) die("usage: up-skills remove <id>");
    return { command: "remove", id };
  }

  if (cmd === "init") {
    const baseUrl = takeFlagValue(argv, "--base-url");
    const homeDir = takeFlagValue(argv, "--home");
    return { command: "init", baseUrl, homeDir };
  }

  return { command: "help" };
}

async function httpJson(baseUrl: string, path: string, init?: RequestInit) {
  const url = baseUrl.replace(/\/+$/, "") + path;
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.error?.message ?? text ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === "help") {
    console.log(`up-skills (MVP)

Usage:
  up-skills init [--base-url <url>] [--home <path>]
  up-skills list
  up-skills search <query>
  up-skills add <raw-skill-md-url> [--alias <name>]
  up-skills get <id> [--json]
  up-skills remove <id>

Env:
  UP_SKILLS_BASE_URL
  UP_SKILLS_TOKEN
`);
    return;
  }

  if (parsed.command === "init") {
    const baseUrl =
      parsed.baseUrl ??
      process.env.UP_SKILLS_BASE_URL ??
      "http://127.0.0.1:8787";
    const homeDir = parsed.homeDir ?? process.env.HOME ?? "";
    if (!homeDir) die("HOME not set (pass --home)");

    const col = await httpJson(baseUrl, "/v1/collections", { method: "POST" });
    const token = col?.token;
    if (typeof token !== "string" || !token) die("invalid /v1/collections response");

    const configPath = (await import("./config")).getConfigPath(homeDir);
    writeConfigFile(configPath, { baseUrl, token });
    console.log(token);
    return;
  }

  const { baseUrl, token } = resolveConfig(process.env, {});
  const auth = { Authorization: `Bearer ${token}` };

  if (parsed.command === "list") {
    const json = await httpJson(baseUrl, "/v1/skills", { headers: auth });
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  if (parsed.command === "search") {
    const q = encodeURIComponent(parsed.q);
    const json = await httpJson(baseUrl, `/v1/skills/search?q=${q}`, { headers: auth });
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  if (parsed.command === "add") {
    const json = await httpJson(baseUrl, "/v1/skills", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        source_url: parsed.sourceUrl,
        ...(parsed.alias ? { alias: parsed.alias } : {}),
      }),
    });
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  if (parsed.command === "remove") {
    const url = baseUrl.replace(/\/+$/, "") + `/v1/skills/${parsed.id}`;
    const res = await fetch(url, { method: "DELETE", headers: auth });
    if (res.status !== 204) {
      throw new Error(await res.text());
    }
    return;
  }

  if (parsed.command === "get") {
    const json = await httpJson(baseUrl, `/v1/skills/${parsed.id}`, {
      headers: auth,
    });
    if (parsed.json) {
      console.log(JSON.stringify(json, null, 2));
      return;
    }
    const content = json?.content;
    if (typeof content !== "string") die("invalid get response: missing content");
    process.stdout.write(content);
    return;
  }
}

// Compatible with Node ESM and bundlers. When imported for tests, this won't run.
function safeRealpath(p: string) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

const argv1 = process.argv[1] ?? "";
const argvHref = argv1 ? pathToFileURL(safeRealpath(argv1)).href : "";
const selfHref = pathToFileURL(safeRealpath(fileURLToPath(import.meta.url))).href;
const isMain = argvHref !== "" && argvHref === selfHref;
if (isMain) {
  main().catch((e) => die(String(e?.message ?? e)));
}
