import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { siteStore } from "./content.mjs";

const scryptAsync = promisify(scrypt);

export const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
// Uzunluktan bağımsız, sabit zamanlı karşılaştırma.
export const safeEqual = (a, b) =>
  timingSafeEqual(createHash("sha256").update(String(a)).digest(), createHash("sha256").update(String(b)).digest());

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(String(password), salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export async function checkPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const hash = await scryptAsync(String(password), Buffer.from(record.salt, "hex"), 64);
  return timingSafeEqual(hash, Buffer.from(record.hash, "hex"));
}

// Oturum imzaları için anahtarlar Blobs'ta tutulur; ilk kullanımda üretilir.
export async function getSecret(name) {
  const store = siteStore();
  let secret = await store.get(`auth/${name}`);
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    await store.set(`auth/${name}`, secret);
  }
  return secret;
}

export async function rotateSecret(name) {
  await siteStore().set(`auth/${name}`, randomBytes(32).toString("hex"));
}

const sign = (secret, payload) => createHmac("sha256", secret).update(payload).digest("base64url");

export async function signToken(secretName, data, days) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + days * 864e5 })).toString("base64url");
  return `${payload}.${sign(await getSecret(secretName), payload)}`;
}

export async function verifyToken(secretName, token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(signature, sign(await getSecret(secretName), payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Date.now() < data.exp ? data : null;
  } catch {
    return null;
  }
}

export function readCookie(req, name) {
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export function cookie(req, name, value, { maxAge, httpOnly = true, sameSite = "Strict" } = {}) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; ${httpOnly ? "HttpOnly; " : ""}SameSite=${sameSite}; Max-Age=${maxAge}${secure}`;
}
