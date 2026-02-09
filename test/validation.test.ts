import { describe, expect, test } from "bun:test";

import { validateSourceUrl } from "../src/api/validation";

describe("validateSourceUrl", () => {
  test("accepts a valid raw.githubusercontent.com SKILL.md URL", () => {
    const url = validateSourceUrl(
      "https://raw.githubusercontent.com/a/b/main/x/SKILL.md",
    );
    expect(url.hostname).toBe("raw.githubusercontent.com");
    expect(url.pathname.endsWith("/SKILL.md")).toBe(true);
  });

  test("rejects non-https", () => {
    expect(() =>
      validateSourceUrl("http://raw.githubusercontent.com/a/b/main/x/SKILL.md"),
    ).toThrow();
  });

  test("rejects non-allowlisted host", () => {
    expect(() =>
      validateSourceUrl("https://example.com/a/b/main/x/SKILL.md"),
    ).toThrow();
  });

  test("rejects query/fragment", () => {
    expect(() =>
      validateSourceUrl(
        "https://raw.githubusercontent.com/a/b/main/x/SKILL.md?x=1",
      ),
    ).toThrow();
    expect(() =>
      validateSourceUrl(
        "https://raw.githubusercontent.com/a/b/main/x/SKILL.md#frag",
      ),
    ).toThrow();
  });

  test("rejects paths not ending in /SKILL.md", () => {
    expect(() =>
      validateSourceUrl("https://raw.githubusercontent.com/a/b/main/x/README.md"),
    ).toThrow();
    expect(() =>
      validateSourceUrl("https://raw.githubusercontent.com/a/b/main/x/SKILL.md/"),
    ).toThrow();
  });
});

