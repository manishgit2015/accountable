// V-S16 (SEC-15): the built frontend holds nothing from .env but SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.
// Run by `npm run check` after it builds the frontend. Fails if frontend/dist is missing or empty, or if any
// built file holds what only a secret would bring:
// - the names DATABASE_URL or ACCOUNTABLE_TEST_AUTH_KEYS,
// - a database address with a user in it (postgresql://user:password@host),
// - a Supabase secret key: sb_secret_ followed by the key itself. The bare prefix is allowed, because the
//   Supabase client checks keys with it to refuse a secret key in a browser (its own safety check),
// - a JWT whose role is service_role: every token-shaped string is decoded and its role read.
// Usage: node scripts/check-bundle.mjs [dist folder]. Node built-ins only.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.argv[2] ? resolve(process.argv[2]) : join(root, "frontend", "dist");

const PATTERNS = [
  ["the name DATABASE_URL", /DATABASE_URL/],
  ["the name ACCOUNTABLE_TEST_AUTH_KEYS", /ACCOUNTABLE_TEST_AUTH_KEYS/],
  ["a database address with a user in it", /postgres(?:ql)?:\/\/[^\s"'`/@]+@/i],
  ["a Supabase secret key", /sb_secret_[A-Za-z0-9_-]{16,}/],
];
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+/g;

function files(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** The role in a JWT's payload, or null if it doesn't decode. */
function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function problemsIn(text) {
  const found = PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([what]) => what);
  for (const token of text.match(JWT) ?? []) {
    if (jwtRole(token) === "service_role") found.push("a service_role key (a JWT with role service_role)");
  }
  return found;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(dist, "index.html"))) {
    console.error(`No built frontend at ${dist}: run npm run build first.`);
    process.exit(1);
  }
  const built = files(dist);
  const problems = [];
  let scanned = 0;
  for (const path of built) {
    const text = readFileSync(path, "latin1");
    scanned += text.length;
    for (const what of problemsIn(text)) problems.push(`${relative(root, path)} holds ${what}`);
  }
  if (scanned === 0) {
    console.error("The built frontend is empty, so it couldn't be checked.");
    process.exit(1);
  }
  if (problems.length > 0) {
    console.error(`The built frontend holds something it mustn't (SEC-15):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`Built frontend checked: ${built.length} files, ${scanned} bytes, no secret found (SEC-15).`);
}
