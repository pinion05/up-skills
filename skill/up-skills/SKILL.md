---
name: up-skills
description: Use when you need to discover or fetch remote skills from an up-skills playlist (list/search/get) and inject the SKILL.md content into the session.
---

# up-skills (Remote Skills Playlist)

This skill is a gateway to **remote skills** stored as pointers in an up-skills playlist.

Important: in MVP, remote skills are **single-file only** (`SKILL.md`). Multi-file skills (scripts, references, templates) are not supported.

## Prerequisites

You must have:

- `up-skills` CLI available (bin from this repo)
- A playlist token
- API base URL

Recommended env vars:

- `UP_SKILLS_BASE_URL`
- `UP_SKILLS_TOKEN`

If you don't have a token, run:

```bash
up-skills init
```

## Workflow

1. **Search** for a skill in your playlist:

```bash
up-skills search "<keywords>"
```

2. Pick an `id` from the results.

3. **Get** the latest remote `SKILL.md` content and inject it into the session:

```bash
up-skills get <id>
```

4. Now follow the workflow described by that fetched SKILL.md (treat it like a normal skill).

## Notes

- `up-skills get` always aims to return the **latest** version from GitHub Raw (ETag revalidation).
- `up-skills search` filters your stored list; it does **not** fetch from GitHub.

