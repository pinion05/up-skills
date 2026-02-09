import { createApp } from "./app";
import { UpSkillsRepo } from "./db";

const port = Number(process.env.PORT ?? "8787");
const dbPath = process.env.UP_SKILLS_DB_PATH ?? "./up-skills.sqlite";
const tokenSalt = process.env.UP_SKILLS_TOKEN_SALT ?? "dev";

const repo = new UpSkillsRepo(dbPath, { tokenSalt });
const app = createApp({ repo, fetchImpl: fetch });

// Bun.serve expects a fetch handler.
Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`up-skills API listening on http://127.0.0.1:${port}`);

