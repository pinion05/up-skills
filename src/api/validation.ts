export class ValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type ValidateSourceUrlOptions = {
  maxLength?: number;
  allowedHosts?: string[];
};

const DEFAULT_ALLOWED_HOSTS = ["raw.githubusercontent.com"];

export function validateSourceUrl(
  input: string,
  opts: ValidateSourceUrlOptions = {},
): URL {
  const maxLength = opts.maxLength ?? 2048;
  const allowedHosts = opts.allowedHosts ?? DEFAULT_ALLOWED_HOSTS;

  if (typeof input !== "string" || input.length === 0) {
    throw new ValidationError("invalid_url", "source_url must be a non-empty string");
  }
  if (input.length > maxLength) {
    throw new ValidationError("url_too_long", `source_url must be <= ${maxLength} chars`);
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ValidationError("invalid_url", "source_url must be a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new ValidationError("invalid_protocol", "source_url must use https");
  }
  if (!allowedHosts.includes(url.hostname)) {
    throw new ValidationError("host_not_allowed", `host not allowed: ${url.hostname}`);
  }
  if (url.search || url.hash) {
    throw new ValidationError("no_query_or_fragment", "query/fragment not allowed");
  }

  // MVP: require direct SKILL.md pointers.
  if (!url.pathname.endsWith("/SKILL.md")) {
    throw new ValidationError("not_skill_md", "path must end with /SKILL.md");
  }

  return url;
}

