import { describe, expect, test } from "bun:test";

import { parseSkillFrontmatter } from "../src/api/frontmatter";

describe("parseSkillFrontmatter", () => {
  test("extracts name and description from YAML frontmatter", () => {
    const md = `---\nname: hello\ndescription: world\n---\n\n# Body\n`;
    const meta = parseSkillFrontmatter(md);
    expect(meta.name).toBe("hello");
    expect(meta.description).toBe("world");
  });

  test("supports CRLF", () => {
    const md = `---\r\nname: hi\r\ndescription: there\r\n---\r\nx\r\n`;
    const meta = parseSkillFrontmatter(md);
    expect(meta.name).toBe("hi");
    expect(meta.description).toBe("there");
  });

  test("rejects missing frontmatter", () => {
    expect(() => parseSkillFrontmatter("# nope\n")).toThrow();
  });

  test("rejects missing fields", () => {
    expect(() =>
      parseSkillFrontmatter(`---\nname: only\n---\nbody\n`),
    ).toThrow();
    expect(() =>
      parseSkillFrontmatter(`---\ndescription: only\n---\nbody\n`),
    ).toThrow();
  });
});

