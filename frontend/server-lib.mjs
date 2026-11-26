// Pure helpers for server.mjs, kept separate so they can be unit tested.
import path from "node:path";

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

// Files in the served directory that are not part of the website.
const PRIVATE = new Set(["server.mjs", "server-lib.mjs", "package.json", "railway.json"]);
const PRIVATE_DIRS = new Set(["tests", "node_modules"]);

/**
 * Maps a request URL path to an absolute file path inside `root`, or null when it must not be served.
 * Rejects traversal, NUL bytes, bad encodings, dotfiles and the server's own files.
 */
export function resolveRequestPath(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((s) => s === ".." || s === "." || s.startsWith("."))) return null;
  if (segments.length === 1 && PRIVATE.has(segments[0])) return null;
  if (segments.length && PRIVATE_DIRS.has(segments[0])) return null;
  const base = path.resolve(root);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

export function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** Cache policy: pages and config always revalidate, the rest may be cached briefly. */
export function cacheControlFor(file) {
  const ext = path.extname(file).toLowerCase();
  return ext === ".html" || path.basename(file) === "config.js" ? "no-cache" : "public, max-age=300";
}

/** Builds the source of js/config.js from the environment. Throws when a required variable is missing. */
export function buildConfigSource(env) {
  const names = { apiUrl: "API_URL", supabaseUrl: "SUPABASE_URL", supabasePublishableKey: "SUPABASE_PUBLISHABLE_KEY" };
  const clean = {};
  const missing = [];
  for (const [key, name] of Object.entries(names)) {
    const value = env[name]?.trim();
    if (value) clean[key] = value.replace(/\/+$/, "");
    else missing.push(name);
  }
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return `// Generated at start from environment variables. Do not edit.\nexport const config = ${JSON.stringify(clean, null, 2)};\n`;
}
