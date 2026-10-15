// Netlify hesabı ya da internet gerektirmeyen basit yerel geliştirme sunucusu.
// public/ klasörünü sunar, netlify/functions içindeki fonksiyonları çalıştırır ve
// Netlify Blobs'u .netlify/local-blobs klasöründe taklit eder.
//
//   ADMIN_PASSWORD=deneme123 npm run dev:local   ->  http://localhost:8888
//
// BLOBS_DIR ile veri klasörü değiştirilebilir (testler geçici bir klasör kullanır).

import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setEnvironmentContext } from "@netlify/blobs";
import { BlobsServer } from "@netlify/blobs/server";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 8888);

const blobsDir = process.env.BLOBS_DIR ? resolve(process.env.BLOBS_DIR) : join(root, ".netlify", "local-blobs");
await mkdir(blobsDir, { recursive: true });
const token = "local-dev-token";
const blobs = new BlobsServer({ directory: blobsDir, token });
const { port: blobsPort } = await blobs.start();
const blobsURL = `http://localhost:${blobsPort}`;
setEnvironmentContext({ edgeURL: blobsURL, uncachedEdgeURL: blobsURL, siteID: "local-site", token, deployID: "0" });
globalThis.Netlify = { env: { get: (name) => process.env[name] } };

const toMatcher = (pattern) => {
  const parts = pattern.split("/");
  const wildcard = parts.at(-1) === "*";
  if (wildcard) parts.pop();
  return (pathname) => {
    const segs = pathname.split("/");
    if (wildcard ? segs.length <= parts.length : segs.length !== parts.length) return null;
    const params = {};
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(":")) params[parts[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (parts[i] !== segs[i]) return null;
    }
    return params;
  };
};

const functionsDir = join(root, "netlify", "functions");
const routes = [];
for (const file of await readdir(functionsDir)) {
  if (!/\.m?js$/.test(file)) continue;
  const mod = await import(pathToFileURL(join(functionsDir, file)).href);
  const paths = [mod.config?.path].flat().filter(Boolean);
  const methods = mod.config?.method ? [mod.config.method].flat() : null;
  for (const p of paths) routes.push({ name: file, match: toMatcher(p), methods, handler: mod.default });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".jpeg": "image/jpeg",
};

async function serveStatic(pathname, res) {
  let file = resolve(join(publicDir, decodeURIComponent(pathname)));
  if (file !== publicDir && !file.startsWith(publicDir + sep)) return false;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

createServer(async (req, res) => {
  let url = new URL(req.url, `http://${req.headers.host}`);
  // Netlify Image CDN yerelde yok; görsel boyutlandırılmadan olduğu gibi sunulur.
  if (url.pathname === "/.netlify/images" && url.searchParams.get("url")?.startsWith("/")) {
    url = new URL(url.searchParams.get("url"), url.origin);
  }
  try {
    for (const route of routes) {
      const params = route.match(url.pathname);
      if (!params || (route.methods && !route.methods.includes(req.method))) continue;
      const hasBody = !["GET", "HEAD"].includes(req.method);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: hasBody ? "half" : undefined,
      });
      const response = await route.handler(request, { params, ip: req.socket.remoteAddress });
      const headers = Object.fromEntries(response.headers);
      const cookies = response.headers.getSetCookie?.() || [];
      if (cookies.length) headers["set-cookie"] = cookies;
      res.writeHead(response.status, headers);
      if (response.body && req.method !== "HEAD") Readable.fromWeb(response.body).pipe(res);
      else res.end();
      console.log(`${req.method} ${url.pathname} -> ${route.name} ${response.status}`);
      return;
    }
    if (await serveStatic(url.pathname, res)) return;
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(await readFile(join(publicDir, "404.html")));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Sunucu hatası");
  }
}).listen(port, () => {
  console.log(`Yerel sunucu: http://localhost:${port}  (panel: http://localhost:${port}/admin/)`);
  if (!process.env.ADMIN_PASSWORD) console.log("Uyarı: ADMIN_PASSWORD tanımlı değil, panele giriş yapılamaz.");
});
