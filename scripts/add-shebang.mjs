import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/add-shebang.mjs <file>");
  process.exit(1);
}

const shebang = "#!/usr/bin/env node\n";
const content = readFileSync(file, "utf8");

if (content.startsWith(shebang)) {
  process.exit(0);
}

// If a previous build accidentally embedded "\n" literally, strip that too.
const cleaned = content.replace(/^#!\/usr\/bin\/env node\\n/, "#!/usr/bin/env node");
writeFileSync(file, shebang + cleaned.replace(/^#!.*\n/, ""), "utf8");

