# up-skills

up-skills is a thin “skills playlist” layer for Codex CLI.

It keeps Codex's native, filesystem-based skills model intact (skills are still discovered from
`~/.agents/skills/`), while removing the day-to-day pain of managing dozens of skill folders locally.

The core idea: store *pointers* to skills in a small service, and fetch the latest `SKILL.md` from
public GitHub Raw on demand.

## MVP Principles

- GitHub is **read-only** (no commits/PRs from this system).
- The server + DB are a **thin layer**:
  - a single token represents a collection (playlist)
  - the DB stores only skill pointers (raw `SKILL.md` URLs) and extracted metadata
- `add/remove/list/search` operate purely on the DB.
- `get` fetches **the latest** `SKILL.md` from GitHub Raw (with ETag revalidation).
- `search` is just “list then filter by keyword” (no GitHub calls).

## What This Is (and isn't)

This repository currently contains only the public-facing overview.

MVP non-goals:

- Multi-file skills (`scripts/`, `reference/`, templates, etc.) are not supported in MVP.
- Private GitHub repos and non-GitHub sources are not supported in MVP.

## Why Not MCP?

This project intentionally targets Codex's existing *skills* workflow (file-based discovery),
so you can adopt it without having to standardize on MCP everywhere.

## Running The API (local)

```bash
bun install
export UP_SKILLS_TOKEN_SALT="change-me"
export UP_SKILLS_DB_PATH="./up-skills.sqlite"
bun run start
```

## CLI Usage

Build the CLI bundle:

```bash
bun run build:cli
node dist/up-skills.js --help
```

Create a playlist token (writes config to `~/.config/up-skills/config.json`):

```bash
UP_SKILLS_BASE_URL="https://<your-api-base-url>" node dist/up-skills.js init
```

Add a skill pointer (must be a public GitHub Raw `.../SKILL.md` URL):

```bash
UP_SKILLS_BASE_URL="https://<your-api-base-url>" UP_SKILLS_TOKEN="ups_..." \
  node dist/up-skills.js add "https://raw.githubusercontent.com/<org>/<repo>/<ref>/path/to/SKILL.md" --alias my-skill
```

Fetch the latest `SKILL.md` (prints raw content to stdout):

```bash
UP_SKILLS_BASE_URL="https://<your-api-base-url>" UP_SKILLS_TOKEN="ups_..." \
  node dist/up-skills.js get <id>
```

