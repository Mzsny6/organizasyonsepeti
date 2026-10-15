// Testler için yerel sunucuyu geçici bir veri klasörüyle başlatır; SMS kodları sunucu kaydından okunur.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
export const ADMIN_PASSWORD = "test-admin-12345";

export async function startServer(extraEnv = {}) {
  const blobsDir = await mkdtemp(join(tmpdir(), "os-test-"));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ["scripts/dev-server.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), BLOBS_DIR: blobsDir, ADMIN_PASSWORD, SMS_TEST_MODE: "1", ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Sunucu başlamadı:\n${log}`)), 15000);
    child.stdout.on("data", () => log.includes("Yerel sunucu") && (clearTimeout(timer), resolve()));
    child.on("exit", (code) => reject(new Error(`Sunucu kapandı (${code}):\n${log}`)));
  });
  return {
    base: `http://127.0.0.1:${port}`,
    log: () => log,
    // Son gönderilen SMS kodu (SMS_TEST_MODE çıktısından)
    async otp(mobile) {
      for (let i = 0; i < 40; i++) {
        const codes = [...log.matchAll(new RegExp(`\\[SMS TEST\\] ${mobile}: .*?(\\d{6})`, "g"))];
        if (codes.length) return codes.at(-1)[1];
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error(`${mobile} için SMS kodu bulunamadı`);
    },
    async stop() {
      child.kill();
      await rm(blobsDir, { recursive: true, force: true });
    },
  };
}

// Çerezleri saklayan basit istemci (tarayıcı oturumu gibi).
export class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }
  async req(method, path, body, headers = {}) {
    const res = await fetch(this.base + path, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(this.cookies.size && { Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [name, ...rest] = pair.split("=");
      const value = rest.join("=");
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, data, headers: res.headers };
  }
  get = (path) => this.req("GET", path);
  post = (path, body = {}) => this.req("POST", path, body);
  put = (path, body = {}) => this.req("PUT", path, body);
  del = (path, body) => this.req("DELETE", path, body);
}
