import { parse as parseYaml } from "yaml";

export class FrontmatterError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type SkillFrontmatter = {
  name: string;
  description: string;
  raw: unknown;
};

export type FrontmatterConstraints = {
  maxNameLength?: number;
  maxDescriptionLength?: number;
};

export function parseSkillFrontmatter(
  content: string,
  constraints: FrontmatterConstraints = {},
): SkillFrontmatter {
  const maxNameLength = constraints.maxNameLength ?? 64;
  const maxDescriptionLength = constraints.maxDescriptionLength ?? 1024;

  if (typeof content !== "string" || content.length === 0) {
    throw new FrontmatterError("invalid_content", "content must be a non-empty string");
  }

  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new FrontmatterError("missing_frontmatter", "missing YAML frontmatter");
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    throw new FrontmatterError("unterminated_frontmatter", "unterminated YAML frontmatter");
  }

  const yamlText = lines.slice(1, endIdx).join("\n");
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch {
    throw new FrontmatterError("invalid_yaml", "invalid YAML frontmatter");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new FrontmatterError("invalid_frontmatter", "frontmatter must be a YAML object");
  }

  const obj = parsed as Record<string, unknown>;
  const name = obj["name"];
  const description = obj["description"];

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new FrontmatterError("missing_name", "frontmatter.name must be a non-empty string");
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    throw new FrontmatterError(
      "missing_description",
      "frontmatter.description must be a non-empty string",
    );
  }

  if (name.length > maxNameLength) {
    throw new FrontmatterError("name_too_long", `name must be <= ${maxNameLength} chars`);
  }
  if (description.length > maxDescriptionLength) {
    throw new FrontmatterError(
      "description_too_long",
      `description must be <= ${maxDescriptionLength} chars`,
    );
  }

  return { name, description, raw: parsed };
}

