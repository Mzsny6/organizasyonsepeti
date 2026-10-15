import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { siteStore } from "./content.mjs";
import { HttpError, env } from "./http.mjs";

const scryptAsync = promisify(scrypt);
const COOKIE = "os_admin";
const SESSION_DAYS = 7;

const sha256 = (s) => createHash("sha256").update(String(s)).digest();
// Uzunluktan bağımsız, sabit zamanlı karşılaştırma.
const safeEqual = (a, b) => timingSafeEqual(sha256(a), sha256(b));
const sign = (secret, payload) => createHmac("sha256", secret).update(payload).digest("base64url");
const envFingerprint = (pw) => sha256(`env:${pw || ""}`).toString("hex");

async function getSecret() {
  const store = siteStore();
  let secret = await store.get("auth/secret");
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    await store.set("auth/secret", secret);
  }
  return secret;
}

// Panelden değiştirilen şifre, yalnızca ADMIN_PASSWORD ortam değişkeni değişmediği sürece geçerlidir.
// Şifre unutulursa Netlify'da ADMIN_PASSWORD'ü yeni bir değere ayarlamak yeterlidir.
async function customPassword() {
  const record = await siteStore().get("auth/password", { type: "json" });
  return record && record.envFingerprint === envFingerprint(env("ADMIN_PASSWORD")) ? record : null;
}

export async function verifyPassword(password) {
  const custom = await customPassword();
  if (custom) {
    const hash = await scryptAsync(String(password), Buffer.from(custom.salt, "hex"), 64);
    return timingSafeEqual(hash, Buffer.from(custom.hash, "hex"));
  }
  const envPassword = env("ADMIN_PASSWORD");
  if (!envPassword) {
    throw new HttpError(503, "Yönetici şifresi ayarlanmamış. Netlify'da ADMIN_PASSWORD ortam değişkenini tanımlayın.");
  }
  return safeEqual(password, envPassword);
}

export async function setPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(String(password), salt, 64);
  const store = siteStore();
  await store.setJSON("auth/password", {
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
    envFingerprint: envFingerprint(env("ADMIN_PASSWORD")),
    updatedAt: new Date().toISOString(),
  });
  // Yeni anahtar: diğer tüm açık oturumlar kapanır.
  await store.set("auth/secret", randomBytes(32).toString("hex"));
}

export async function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return `${payload}.${sign(await getSecret(), payload)}`;
}

function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function isAuthenticated(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(await getSecret(), payload))) return false;
  try {
    return Date.now() < JSON.parse(Buffer.from(payload, "base64url").toString()).exp;
  } catch {
    return false;
  }
}

export async function requireAdmin(req) {
  if (!(await isAuthenticated(req))) throw new HttpError(401, "Oturumunuz sona erdi, lütfen tekrar giriş yapın.");
}

const secureFlag = (req) => (new URL(req.url).protocol === "https:" ? "; Secure" : "");

export const sessionCookie = (req, token) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secureFlag(req)}`;

export const clearedCookie = (req) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag(req)}`;

// Basit, IP başına sayaç. Kişisel veri saklamamak için IP'nin özeti tutulur.
const limitKey = (bucket, ip) =>
  `limits/${bucket}/${sha256(ip || "unknown")
    .toString("hex")
    .slice(0, 32)}`;

export async function isLimited(bucket, ip, max, windowMs) {
  const record = await siteStore().get(limitKey(bucket, ip), { type: "json" });
  return Boolean(record && Date.now() - record.first < windowMs && record.count >= max);
}

export async function countHit(bucket, ip, windowMs) {
  const store = siteStore();
  const key = limitKey(bucket, ip);
  let record = await store.get(key, { type: "json" });
  if (!record || Date.now() - record.first >= windowMs) record = { first: Date.now(), count: 0 };
  record.count += 1;
  await store.setJSON(key, record);
}

export const resetHits = (bucket, ip) => siteStore().delete(limitKey(bucket, ip));
