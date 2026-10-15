// Site yöneticisi (panel) oturumu.
import {
  checkPassword,
  cookie,
  hashPassword,
  readCookie,
  rotateSecret,
  safeEqual,
  sha256,
  signToken,
  verifyToken,
} from "./crypto.mjs";
import { siteStore } from "./content.mjs";
import { HttpError, env } from "./http.mjs";

const COOKIE = "os_admin";
const SECRET = "admin-secret";
const SESSION_DAYS = 7;

const envFingerprint = (pw) => sha256(`env:${pw || ""}`);

// Panelden değiştirilen şifre, yalnızca ADMIN_PASSWORD ortam değişkeni değişmediği sürece geçerlidir.
// Şifre unutulursa Netlify'da ADMIN_PASSWORD'ü yeni bir değere ayarlamak yeterlidir.
async function customPassword() {
  const record = await siteStore().get("auth/password", { type: "json" });
  return record && record.envFingerprint === envFingerprint(env("ADMIN_PASSWORD")) ? record : null;
}

export async function verifyAdminPassword(password) {
  const custom = await customPassword();
  if (custom) return checkPassword(password, custom);
  const envPassword = env("ADMIN_PASSWORD");
  if (!envPassword) {
    throw new HttpError(503, "Yönetici şifresi ayarlanmamış. Netlify'da ADMIN_PASSWORD ortam değişkenini tanımlayın.");
  }
  return safeEqual(password, envPassword);
}

export async function setAdminPassword(password) {
  await siteStore().setJSON("auth/password", {
    ...(await hashPassword(password)),
    envFingerprint: envFingerprint(env("ADMIN_PASSWORD")),
    updatedAt: new Date().toISOString(),
  });
  // Yeni anahtar: diğer tüm yönetici oturumları kapanır.
  await rotateSecret(SECRET);
}

export const createAdminToken = () => signToken(SECRET, { role: "admin" }, SESSION_DAYS);

export async function isAdmin(req) {
  const data = await verifyToken(SECRET, readCookie(req, COOKIE));
  return data?.role === "admin";
}

export async function requireAdmin(req) {
  if (!(await isAdmin(req))) throw new HttpError(401, "Oturumunuz sona erdi, lütfen tekrar giriş yapın.");
}

export const adminCookie = (req, token) => cookie(req, COOKIE, token, { maxAge: SESSION_DAYS * 86400 });
export const clearedAdminCookie = (req) => cookie(req, COOKIE, "", { maxAge: 0 });
