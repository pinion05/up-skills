import { describe, expect, test } from "bun:test";

import { UpSkillsRepo } from "../src/api/db";
import { createApp } from "../src/api/app";

function makeSkillMd(name = "demo-skill", description = "desc") {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# Body\n`;
}

describe("API", () => {
  test("end-to-end: collections + add/list/search/get/delete", async () => {
    const repo = new UpSkillsRepo(":memory:", { tokenSalt: "test-salt" });

    let etag = "\"v1\"";
    let content = makeSkillMd();
    let sawIfNoneMatch: string | null = null;

    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      const inm = headers.get("if-none-match");
      if (inm) sawIfNoneMatch = inm;

      if (inm && inm === etag) {
        return new Response(null, { status: 304, headers: { etag } });
      }
      return new Response(content, { status: 200, headers: { etag } });
    };

    const app = createApp({ repo, fetchImpl });

    // Create collection
    const resCol = await app.request("/v1/collections", { method: "POST" });
    expect(resCol.status).toBe(201);
    const colJson = (await resCol.json()) as { token: string };
    expect(colJson.token.startsWith("ups_")).toBe(true);

    const auth = { Authorization: `Bearer ${colJson.token}` };

    // Add
    const sourceUrl =
      "https://raw.githubusercontent.com/a/b/main/x/SKILL.md";
    const resAdd = await app.request("/v1/skills", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ source_url: sourceUrl, alias: "demo" }),
    });
    expect(resAdd.status).toBe(201);
    const added = (await resAdd.json()) as { id: string; alias: string };
    expect(added.alias).toBe("demo");

    // List
    const resList = await app.request("/v1/skills", { headers: auth });
    expect(resList.status).toBe(200);
    const listJson = (await resList.json()) as { items: Array<{ id: string }> };
    expect(listJson.items.length).toBe(1);
    expect(listJson.items[0]?.id).toBe(added.id);

    // Search
    const resSearch = await app.request("/v1/skills/search?q=demo", {
      headers: auth,
    });
    expect(resSearch.status).toBe(200);
    const searchJson = (await resSearch.json()) as { items: Array<{ id: string }> };
    expect(searchJson.items.length).toBe(1);

    // Get (200)
    const resGet1 = await app.request(`/v1/skills/${added.id}`, { headers: auth });
    expect(resGet1.status).toBe(200);
    const get1 = (await resGet1.json()) as { content: string; etag: string };
    expect(get1.etag).toBe(etag);
    expect(get1.content).toContain("name: demo-skill");

    // Get again (304 path)
    const resGet2 = await app.request(`/v1/skills/${added.id}`, { headers: auth });
    expect(resGet2.status).toBe(200);
    const get2 = (await resGet2.json()) as { content: string };
    expect(get2.content).toBe(get1.content);
    expect(sawIfNoneMatch).toBe(etag);

    // Delete
    const resDel = await app.request(`/v1/skills/${added.id}`, {
      method: "DELETE",
      headers: auth,
    });
    expect(resDel.status).toBe(204);
    const resList2 = await app.request("/v1/skills", { headers: auth });
    const listJson2 = (await resList2.json()) as { items: unknown[] };
    expect(listJson2.items.length).toBe(0);

    repo.close();
  });

  test("requires auth for skills routes", async () => {
    const repo = new UpSkillsRepo(":memory:", { tokenSalt: "test-salt" });
    const app = createApp({ repo, fetchImpl: fetch });
    const res = await app.request("/v1/skills");
    expect(res.status).toBe(401);
    repo.close();
  });
});

