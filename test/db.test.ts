import { describe, expect, test } from "bun:test";

import { UpSkillsRepo } from "../src/api/db";

describe("UpSkillsRepo", () => {
  test("creates collections and manages skill pointers", () => {
    const repo = new UpSkillsRepo(":memory:", { tokenSalt: "test-salt" });

    const { token, collectionId } = repo.createCollection();
    expect(token.startsWith("ups_")).toBe(true);
    expect(collectionId.length).toBeGreaterThan(0);

    const col = repo.getCollectionByToken(token);
    expect(col.id).toBe(collectionId);

    const created = repo.addSkill(collectionId, {
      sourceUrl: "https://raw.githubusercontent.com/a/b/main/x/SKILL.md",
      alias: "demo",
      name: "demo-skill",
      description: "desc",
      etag: "\"v1\"",
      content: "---\nname: demo-skill\ndescription: desc\n---\n",
    });
    expect(created.alias).toBe("demo");

    const listed = repo.listSkills(collectionId);
    expect(listed.length).toBe(1);
    expect(listed[0]?.id).toBe(created.id);

    const searched = repo.searchSkills(collectionId, "demo");
    expect(searched.length).toBe(1);

    repo.deleteSkill(collectionId, created.id);
    expect(repo.listSkills(collectionId).length).toBe(0);
  });
});

