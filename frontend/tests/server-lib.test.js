import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { buildConfigSource, cacheControlFor, mimeFor, resolveRequestPath } from "../server-lib.mjs";

const root = path.resolve("/srv/site");
const inside = (...p) => path.join(root, ...p);
const load = (source) => import("data:text/javascript," + encodeURIComponent(source));

test("normal paths resolve inside the root", () => {
  assert.equal(resolveRequestPath(root, "/js/plan.js"), inside("js", "plan.js"));
  assert.equal(resolveRequestPath(root, "/"), root);
  assert.equal(resolveRequestPath(root, "/css/a.css?v=2#x"), inside("css", "a.css"));
});

test("path traversal is rejected in every encoding", () => {
  for (const bad of ["/../secret", "/js/../../secret", "/%2e%2e/secret", "/%2E%2E%2Fsecret", "/js/..%2f..%2fx", "/..\\x", "/a%5c..%5cb"]) {
    assert.equal(resolveRequestPath(root, bad), null, bad);
  }
});

test("malformed encodings, NUL bytes and dotfiles are rejected", () => {
  for (const bad of ["/%E0%A4%A", "/a%00b", "/.env", "/js/.hidden", "/.git/config"]) {
    assert.equal(resolveRequestPath(root, bad), null, bad);
  }
});

test("the server's own files and tests are not served", () => {
  for (const hidden of ["/server.mjs", "/server-lib.mjs", "/package.json", "/railway.json", "/tests/plan.test.js", "/node_modules/x"]) {
    assert.equal(resolveRequestPath(root, hidden), null, hidden);
  }
  assert.notEqual(resolveRequestPath(root, "/js/package.json"), null);
});

test("mime types and cache policy", () => {
  assert.equal(mimeFor("a.html"), "text/html; charset=utf-8");
  assert.equal(mimeFor("a.JS"), "text/javascript; charset=utf-8");
  assert.equal(mimeFor("a.unknown"), "application/octet-stream");
  assert.equal(cacheControlFor("/x/index.html"), "no-cache");
  assert.equal(cacheControlFor("/x/js/config.js"), "no-cache");
  assert.equal(cacheControlFor("/x/css/a.css"), "public, max-age=300");
});

test("config source carries the three public values and trims trailing slashes", async () => {
  const source = buildConfigSource({
    API_URL: "https://api.example.com/",
    SUPABASE_URL: " https://x.supabase.co ",
    SUPABASE_PUBLISHABLE_KEY: "pk",
    SUPABASE_SECRET_KEY: "must-not-appear",
  });
  assert.ok(!source.includes("must-not-appear"));
  const mod = await load(source);
  assert.deepEqual(mod.config, { apiUrl: "https://api.example.com", supabaseUrl: "https://x.supabase.co", supabasePublishableKey: "pk" });
});

test("config source names every missing variable", () => {
  assert.throws(() => buildConfigSource({ API_URL: "https://a", SUPABASE_URL: "  " }), /SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY/);
});

test("values with quotes cannot break out of the config string", async () => {
  const evil = '"; throw new Error("x"); "';
  const mod = await load(buildConfigSource({ API_URL: evil, SUPABASE_URL: "u", SUPABASE_PUBLISHABLE_KEY: "k" }));
  assert.equal(mod.config.apiUrl, evil);
});
