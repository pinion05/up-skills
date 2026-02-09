import { createHash, randomBytes } from "node:crypto";
import { Database } from "bun:sqlite";

export type UpSkillsRepoOptions = {
  tokenSalt: string;
};

export type CollectionRow = {
  id: string;
  token_hash: string;
  created_at: string;
  last_used_at: string | null;
};

export type SkillRow = {
  id: string;
  collection_id: string;
  source_url: string;
  alias: string | null;
  name: string;
  description: string;
  created_at: string;
  last_etag: string | null;
  last_content: string | null;
  last_fetched_at: string | null;
  last_fetch_status: number | null;
  last_fetch_error: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function randomBase64Url(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

function randomId(prefix: string) {
  return `${prefix}${randomBase64Url(12)}`;
}

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export class UpSkillsRepo {
  #db: Database;
  #tokenSalt: string;

  constructor(dbPath: string, opts: UpSkillsRepoOptions) {
    this.#db = new Database(dbPath);
    this.#tokenSalt = opts.tokenSalt;

    this.#db.exec("PRAGMA foreign_keys = ON;");
    this.#ensureSchema();
  }

  close() {
    this.#db.close();
  }

  hashToken(token: string) {
    return sha256Hex(`${this.#tokenSalt}:${token}`);
  }

  createCollection(): { token: string; collectionId: string } {
    const token = `ups_${randomBase64Url(24)}`;
    const tokenHash = this.hashToken(token);
    const id = randomId("col_");

    const stmt = this.#db.prepare(
      "INSERT INTO collections (id, token_hash, created_at, last_used_at) VALUES (?, ?, ?, NULL)",
    );
    stmt.run(id, tokenHash, nowIso());
    return { token, collectionId: id };
  }

  getCollectionByToken(token: string): { id: string } {
    const tokenHash = this.hashToken(token);
    const row = this.#db
      .prepare("SELECT id FROM collections WHERE token_hash = ?")
      .get(tokenHash) as { id: string } | null;
    if (!row) {
      throw new Error("unauthorized");
    }
    // best-effort update
    this.#db
      .prepare("UPDATE collections SET last_used_at = ? WHERE id = ?")
      .run(nowIso(), row.id);
    return row;
  }

  addSkill(
    collectionId: string,
    input: {
      sourceUrl: string;
      alias?: string | null;
      name: string;
      description: string;
      etag?: string | null;
      content?: string | null;
    },
  ): SkillRow {
    const id = randomId("sk_");
    const createdAt = nowIso();
    const stmt = this.#db.prepare(
      `INSERT INTO skills (
         id, collection_id, source_url, alias, name, description,
         created_at, last_etag, last_content, last_fetched_at, last_fetch_status, last_fetch_error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    stmt.run(
      id,
      collectionId,
      input.sourceUrl,
      input.alias ?? null,
      input.name,
      input.description,
      createdAt,
      input.etag ?? null,
      input.content ?? null,
      input.content ? createdAt : null,
      input.content ? 200 : null,
      null,
    );
    return this.getSkillById(collectionId, id);
  }

  listSkills(collectionId: string): SkillRow[] {
    return this.#db
      .prepare(
        "SELECT * FROM skills WHERE collection_id = ? ORDER BY created_at DESC",
      )
      .all(collectionId) as SkillRow[];
  }

  searchSkills(collectionId: string, q: string): SkillRow[] {
    const query = q.trim();
    if (!query) return this.listSkills(collectionId);

    const like = `%${query}%`;
    return this.#db
      .prepare(
        `SELECT * FROM skills
         WHERE collection_id = ?
           AND (
             alias LIKE ? COLLATE NOCASE OR
             name LIKE ? COLLATE NOCASE OR
             description LIKE ? COLLATE NOCASE OR
             source_url LIKE ? COLLATE NOCASE
           )
         ORDER BY created_at DESC`,
      )
      .all(collectionId, like, like, like, like) as SkillRow[];
  }

  getSkillById(collectionId: string, id: string): SkillRow {
    const row = this.#db
      .prepare("SELECT * FROM skills WHERE collection_id = ? AND id = ?")
      .get(collectionId, id) as SkillRow | null;
    if (!row) throw new Error("not_found");
    return row;
  }

  updateSkillFetch(
    collectionId: string,
    id: string,
    update: {
      etag?: string | null;
      content?: string | null;
      fetchedAt?: string;
      fetchStatus?: number | null;
      fetchError?: string | null;
      name?: string;
      description?: string;
    },
  ): SkillRow {
    // Ensure the row exists under this collection.
    this.getSkillById(collectionId, id);

    const fetchedAt = update.fetchedAt ?? nowIso();
    this.#db
      .prepare(
        `UPDATE skills
         SET last_etag = COALESCE(?, last_etag),
             last_content = COALESCE(?, last_content),
             last_fetched_at = COALESCE(?, last_fetched_at),
             last_fetch_status = ?,
             last_fetch_error = ?,
             name = COALESCE(?, name),
             description = COALESCE(?, description)
         WHERE collection_id = ? AND id = ?`,
      )
      .run(
        update.etag ?? null,
        update.content ?? null,
        fetchedAt,
        update.fetchStatus ?? null,
        update.fetchError ?? null,
        update.name ?? null,
        update.description ?? null,
        collectionId,
        id,
      );
    return this.getSkillById(collectionId, id);
  }

  deleteSkill(collectionId: string, id: string) {
    const res = this.#db
      .prepare("DELETE FROM skills WHERE collection_id = ? AND id = ?")
      .run(collectionId, id);
    if (res.changes === 0) throw new Error("not_found");
  }

  #ensureSchema() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_used_at TEXT
      );

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        alias TEXT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_etag TEXT,
        last_content TEXT,
        last_fetched_at TEXT,
        last_fetch_status INTEGER,
        last_fetch_error TEXT,
        UNIQUE(collection_id, source_url),
        UNIQUE(collection_id, alias),
        FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE
      );
    `);
  }
}

