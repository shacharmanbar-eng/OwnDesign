// Dependency-free static server for Railway. Writes js/config.js from the environment, then serves this folder.
import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildConfigSource, cacheControlFor, mimeFor, resolveRequestPath, SECURITY_HEADERS } from "./server-lib.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5500;

await writeFile(path.join(root, "js", "config.js"), buildConfigSource(process.env));

function send(res, status, body, extra = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8", ...extra });
  res.end(body);
}

http
  .createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", { Allow: "GET, HEAD" });
    if (req.url === "/healthz") return send(res, 200, "ok");
    let file = resolveRequestPath(root, req.url ?? "/");
    if (!file) return send(res, 404, "Not found");
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        file = path.join(file, "index.html"); // never list a directory
        info = await stat(file);
      }
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        "Content-Type": mimeFor(file),
        "Content-Length": info.size,
        "Cache-Control": cacheControlFor(file),
      });
      if (req.method === "HEAD") return res.end();
      createReadStream(file).on("error", () => res.destroy()).pipe(res);
    } catch {
      send(res, 404, "Not found");
    }
  })
  .listen(port, "0.0.0.0", () => console.log(`Serving frontend on port ${port}`));
