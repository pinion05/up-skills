import { describe, expect, test } from "bun:test";

import { parseArgs } from "../src/cli/index";

describe("parseArgs", () => {
  test("parses get", () => {
    expect(parseArgs(["get", "sk_123"])).toEqual({
      command: "get",
      id: "sk_123",
      json: false,
    });
    expect(parseArgs(["get", "sk_123", "--json"])).toEqual({
      command: "get",
      id: "sk_123",
      json: true,
    });
  });

  test("parses add", () => {
    expect(parseArgs(["add", "https://raw.githubusercontent.com/a/b/main/SKILL.md", "--alias", "x"]))
      .toEqual({
        command: "add",
        sourceUrl: "https://raw.githubusercontent.com/a/b/main/SKILL.md",
        alias: "x",
      });
  });
});

