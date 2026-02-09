import { Hono } from "hono";

import { parseSkillFrontmatter } from "./frontmatter";
import { UpSkillsRepo } from "./db";
import { validateSourceUrl } from "./validation";

export type CreateAppDeps = {
  repo: UpSkillsRepo;
  fetchImpl: typeof fetch;
  fetchTimeoutMs?: number;
  maxSkillBytes?: number;
};

type AuthedVars = {
  collectionId: string;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 256 * 1024;

async function readTextWithLimit(res: Response, maxBytes: number): Promise<string> {
  const len = res.headers.get("content-length");
  if (len) {
    const n = Number(len);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new Error("response_too_large");
    }
  }

  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > maxBytes) throw new Error("response_too_large");
      chunks.push(value);
    }
  }

  const out = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return out.toString("utf8");
}

async function fetchSkillMd(
  fetchImpl: typeof fetch,
  url: string,
  opts: { timeoutMs: number; maxBytes: number; ifNoneMatch?: string | null },
): Promise<{ status: number; etag: string | null; content: string | null }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const headers = new Headers();
    if (opts.ifNoneMatch) headers.set("If-None-Match", opts.ifNoneMatch);

    const res = await fetchImpl(url, {
      redirect: "manual",
      signal: controller.signal,
      headers,
    });

    const etag = res.headers.get("etag");
    if (res.status === 304) {
      return { status: 304, etag, content: null };
    }
    // Reject redirects explicitly (allowlist bypass / confusion).
    if (res.status >= 300 && res.status < 400) {
      throw new Error("redirect_not_allowed");
    }
    if (res.status !== 200) {
      throw new Error(`upstream_status_${res.status}`);
    }

    const content = await readTextWithLimit(res, opts.maxBytes);
    return { status: 200, etag, content };
  } finally {
    clearTimeout(t);
  }
}

function jsonError(c: any, status: number, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

export function createApp(deps: CreateAppDeps) {
  const repo = deps.repo;
  const fetchImpl = deps.fetchImpl;
  const timeoutMs = deps.fetchTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = deps.maxSkillBytes ?? DEFAULT_MAX_BYTES;

  const app = new Hono<{ Variables: AuthedVars }>();

  app.post("/v1/collections", (c) => {
    const { token, collectionId } = repo.createCollection();
    return c.json(
      { token, collection_id: collectionId, created_at: new Date().toISOString() },
      201,
    );
  });

  // Auth middleware for skills routes.
  app.use("/v1/skills/*", (c, next) => {
    const auth = c.req.header("authorization") ?? c.req.header("Authorization");
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      return jsonError(c, 401, "unauthorized", "missing bearer token");
    }
    const token = auth.slice("bearer ".length).trim();
    if (!token) return jsonError(c, 401, "unauthorized", "missing bearer token");
    try {
      const { id } = repo.getCollectionByToken(token);
      c.set("collectionId", id);
    } catch {
      return jsonError(c, 401, "unauthorized", "invalid token");
    }
    return next();
  });
  app.use("/v1/skills", (c, next) => {
    // Hono's routing doesn't apply the /v1/skills/* middleware to /v1/skills.
    const auth = c.req.header("authorization") ?? c.req.header("Authorization");
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      return jsonError(c, 401, "unauthorized", "missing bearer token");
    }
    const token = auth.slice("bearer ".length).trim();
    if (!token) return jsonError(c, 401, "unauthorized", "missing bearer token");
    try {
      const { id } = repo.getCollectionByToken(token);
      c.set("collectionId", id);
    } catch {
      return jsonError(c, 401, "unauthorized", "invalid token");
    }
    return next();
  });

  app.post("/v1/skills", async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return jsonError(c, 400, "invalid_json", "invalid JSON body");
    }
    const sourceUrl = body?.source_url;
    const alias = body?.alias;
    if (typeof sourceUrl !== "string") {
      return jsonError(c, 422, "invalid_source_url", "source_url must be a string");
    }
    if (alias != null && typeof alias !== "string") {
      return jsonError(c, 422, "invalid_alias", "alias must be a string");
    }

    try {
      validateSourceUrl(sourceUrl);
    } catch (e: any) {
      return jsonError(c, 422, e?.code ?? "invalid_source_url", e?.message ?? "invalid source_url");
    }

    let fetched;
    try {
      fetched = await fetchSkillMd(fetchImpl, sourceUrl, {
        timeoutMs,
        maxBytes,
      });
    } catch (e: any) {
      return jsonError(c, 502, "upstream_fetch_failed", e?.message ?? "fetch failed");
    }

    const content = fetched.content ?? "";
    let meta;
    try {
      meta = parseSkillFrontmatter(content);
    } catch (e: any) {
      return jsonError(
        c,
        422,
        e?.code ?? "invalid_skill_md",
        e?.message ?? "invalid SKILL.md",
      );
    }

    const collectionId = c.get("collectionId");
    try {
      const row = repo.addSkill(collectionId, {
        sourceUrl: sourceUrl,
        alias: alias ?? null,
        name: meta.name,
        description: meta.description,
        etag: fetched.etag,
        content,
      });
      return c.json(
        {
          id: row.id,
          source_url: row.source_url,
          alias: row.alias,
          name: row.name,
          description: row.description,
          created_at: row.created_at,
        },
        201,
      );
    } catch (e: any) {
      // SQLite unique constraint errors are noisy; keep message stable.
      return jsonError(c, 409, "conflict", e?.message ?? "conflict");
    }
  });

  app.get("/v1/skills", (c) => {
    const collectionId = c.get("collectionId");
    const items = repo.listSkills(collectionId).map((r) => ({
      id: r.id,
      source_url: r.source_url,
      alias: r.alias,
      name: r.name,
      description: r.description,
      created_at: r.created_at,
    }));
    return c.json({ items });
  });

  app.get("/v1/skills/search", (c) => {
    const q = c.req.query("q") ?? "";
    const collectionId = c.get("collectionId");
    const items = repo.searchSkills(collectionId, q).map((r) => ({
      id: r.id,
      source_url: r.source_url,
      alias: r.alias,
      name: r.name,
      description: r.description,
      created_at: r.created_at,
    }));
    return c.json({ items });
  });

  app.get("/v1/skills/:id", async (c) => {
    const id = c.req.param("id");
    const collectionId = c.get("collectionId");
    let row;
    try {
      row = repo.getSkillById(collectionId, id);
    } catch {
      return jsonError(c, 404, "not_found", "skill not found");
    }

    let fetched;
    try {
      fetched = await fetchSkillMd(fetchImpl, row.source_url, {
        timeoutMs,
        maxBytes,
        ifNoneMatch: row.last_etag,
      });
    } catch (e: any) {
      repo.updateSkillFetch(collectionId, id, {
        fetchStatus: 502,
        fetchError: e?.message ?? "fetch failed",
      });
      return jsonError(c, 502, "upstream_fetch_failed", e?.message ?? "fetch failed");
    }

    if (fetched.status === 304) {
      if (!row.last_content) {
        return jsonError(c, 502, "cache_miss", "upstream returned 304 but no cached content");
      }
      const updated = repo.updateSkillFetch(collectionId, id, {
        etag: fetched.etag ?? row.last_etag,
        fetchStatus: 304,
        fetchError: null,
      });
      return c.json({
        id: updated.id,
        source_url: updated.source_url,
        name: updated.name,
        description: updated.description,
        etag: updated.last_etag,
        fetched_at: updated.last_fetched_at,
        content: updated.last_content,
      });
    }

    const content = fetched.content ?? "";
    let meta;
    try {
      meta = parseSkillFrontmatter(content);
    } catch {
      // Still return raw content for debugging; but mark error.
      meta = { name: row.name, description: row.description };
    }

    const updated = repo.updateSkillFetch(collectionId, id, {
      etag: fetched.etag,
      content,
      fetchStatus: 200,
      fetchError: null,
      name: meta.name,
      description: meta.description,
    });

    return c.json({
      id: updated.id,
      source_url: updated.source_url,
      name: updated.name,
      description: updated.description,
      etag: updated.last_etag,
      fetched_at: updated.last_fetched_at,
      content: updated.last_content,
    });
  });

  app.delete("/v1/skills/:id", (c) => {
    const id = c.req.param("id");
    const collectionId = c.get("collectionId");
    try {
      repo.deleteSkill(collectionId, id);
    } catch {
      return jsonError(c, 404, "not_found", "skill not found");
    }
    return c.body(null, 204);
  });

  return app;
}
