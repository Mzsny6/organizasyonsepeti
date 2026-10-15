// Üyeler: ilan veren organizatörler (role: "organizer") ve telefonunu doğrulayan ziyaretçiler (role: "client").
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { checkPassword, cookie, hashPassword, readCookie, sha256, signToken, verifyToken } from "./crypto.mjs";
import { HttpError } from "./http.mjs";

const COOKIE = "os_user";
// Arayüzün "Giriş yap / Hesabım" düğmesini seçebilmesi için JS'in okuyabildiği işaret çerezi (gizli bilgi içermez).
const HINT_COOKIE = "os_in";
const SECRET = "user-secret";
const SESSION_DAYS = 30;

export const userStore = () => getStore({ name: "users", consistency: "strong" });
const emailKey = (email) => `email/${sha256(email)}`;
const phoneKey = (phone) => `phone/${sha256(phone)}`;
export const USER_ID = /^[a-f0-9]{12}$/;

export const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLocaleLowerCase("tr");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Türkiye numaraları "05xx xxx xx xx" biçiminde gösterilir; diğerleri olduğu gibi kalır.
export function formatPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("5")) digits = `0${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  return String(value || "").trim();
}

// Türk cep telefonu numarasını 905XXXXXXXXX biçimine getirir; değilse "" döner.
export function normalizeMobile(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return /^5\d{9}$/.test(digits) ? `90${digits}` : "";
}

export const maskPhone = (mobile) => (mobile ? `0${mobile.slice(2, 5)} *** ** ${mobile.slice(-2)}` : "");

// T.C. kimlik numarası resmi kontrol algoritması
function isValidTc(t) {
  if (!/^[1-9]\d{10}$/.test(t)) return false;
  const n = [...t].map(Number);
  const d10 = ((n[0] + n[2] + n[4] + n[6] + n[8]) * 7 - (n[1] + n[3] + n[5] + n[7])) % 10;
  const d11 = n.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return (d10 + 10) % 10 === n[9] && d11 === n[10];
}

export function validateTcVkn(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || (digits.length === 11 && isValidTc(digits))) return digits;
  throw new HttpError(400, "Lütfen geçerli bir T.C. kimlik numarası (11 hane) ya da vergi numarası (10 hane) yazın.");
}

const clean = (value, max) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

export function validateProfile(input) {
  const profile = {
    name: clean(input.name, 80),
    company: clean(input.company, 80),
    phone: formatPhone(clean(input.phone, 30)),
  };
  if (profile.name.length < 3) throw new HttpError(400, "Lütfen adınızı ve soyadınızı yazın.");
  if (profile.company.length < 2) throw new HttpError(400, "Lütfen firma ya da marka adınızı yazın.");
  if (profile.phone.replace(/\D/g, "").length < 10)
    throw new HttpError(400, "Lütfen geçerli bir telefon numarası yazın.");
  return profile;
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) throw new HttpError(400, "Şifre en az 8 karakter olmalı.");
  if (password.length > 200) throw new HttpError(400, "Şifre çok uzun.");
  return password;
}

export async function createUser(input) {
  const email = normalizeEmail(input.email);
  if (!EMAIL.test(email) || email.length > 120) throw new HttpError(400, "Lütfen geçerli bir e-posta adresi yazın.");
  const profile = validateProfile(input);
  validatePassword(input.password);
  const tcVkn = validateTcVkn(input.tcVkn);
  if (!input.acceptTerms) throw new HttpError(400, "Devam etmek için kullanım koşullarını ve KVKK metnini onaylayın.");

  const store = userStore();
  const id = randomBytes(6).toString("hex");
  const claimed = await store.set(emailKey(email), id, { onlyIfNew: true });
  if (!claimed.modified) throw new HttpError(409, "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.");

  const user = {
    id,
    email,
    ...profile,
    role: "organizer",
    tcVkn,
    phoneVerified: false,
    verifiedPhone: "",
    password: await hashPassword(input.password),
    status: "active",
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
    termsAcceptedAt: new Date().toISOString(),
  };
  await store.setJSON(`u/${id}`, user);
  return user;
}

export async function getUser(id) {
  if (!USER_ID.test(String(id))) return null;
  return userStore().get(`u/${id}`, { type: "json" });
}

export const saveUser = (user) => userStore().setJSON(`u/${user.id}`, user);

export async function findUserByEmail(email) {
  const id = await userStore().get(emailKey(normalizeEmail(email)));
  return id ? getUser(id) : null;
}

export async function authenticate(email, password) {
  const user = await findUserByEmail(email);
  // Kullanıcı yoksa da şifre karşılaştırması yapılır; yanıt süresinden hesap varlığı anlaşılmasın.
  const ok = await checkPassword(password, user?.password ?? { salt: "00", hash: "00".repeat(64) });
  if (!user || !ok) throw new HttpError(401, "E-posta adresi veya şifre hatalı.");
  if (user.status === "banned")
    throw new HttpError(403, "Hesabınız askıya alınmıştır. Bilgi için bizimle iletişime geçin.");
  return user;
}

// SMS ile doğrulanan ziyaretçi hesabı: telefon numarası anahtardır, şifre yoktur.
export async function findOrCreateClient(mobile) {
  const store = userStore();
  const existingId = await store.get(phoneKey(mobile));
  if (existingId) {
    const existing = await getUser(existingId);
    if (existing) return existing;
  }
  const id = randomBytes(6).toString("hex");
  const claimed = await store.set(phoneKey(mobile), id, { onlyIfNew: true });
  if (!claimed.modified) return getUser(await store.get(phoneKey(mobile)));
  const user = {
    id,
    role: "client",
    email: "",
    name: "",
    company: "",
    phone: formatPhone(mobile),
    phoneVerified: true,
    verifiedPhone: mobile,
    status: "active",
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
  };
  await store.setJSON(`u/${id}`, user);
  return user;
}

export async function listUsers() {
  const store = userStore();
  const { blobs } = await store.list({ prefix: "u/" });
  const users = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return users.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteUserRecord(user) {
  const store = userStore();
  await Promise.all([
    store.delete(`u/${user.id}`),
    user.email && store.delete(emailKey(user.email)),
    user.role === "client" && user.verifiedPhone && store.delete(phoneKey(user.verifiedPhone)),
  ]);
}

// Şifre ya da engel değişince sessionVersion artırılır; eski oturumlar geçersiz olur.
export async function setUserPassword(user, password) {
  user.password = await hashPassword(validatePassword(password));
  user.sessionVersion = (user.sessionVersion || 1) + 1;
  await saveUser(user);
}

export const publicUser = (user) => ({
  id: user.id,
  role: user.role || "organizer",
  email: user.email,
  name: user.name,
  company: user.company,
  phone: user.phone,
  phoneVerified: Boolean(user.phoneVerified),
  tcVkn: user.tcVkn ? `${"•".repeat(user.tcVkn.length - 4)}${user.tcVkn.slice(-4)}` : "",
  status: user.status,
  createdAt: user.createdAt,
});

export function requireOrganizer(user) {
  if ((user.role || "organizer") !== "organizer")
    throw new HttpError(403, "Bu işlem için organizatör (firma) hesabı gerekir.");
  return user;
}

export const createUserToken = (user) => signToken(SECRET, { uid: user.id, sv: user.sessionVersion }, SESSION_DAYS);

export async function getSessionUser(req) {
  const data = await verifyToken(SECRET, readCookie(req, COOKIE));
  if (!data) return null;
  const user = await getUser(data.uid);
  if (!user || user.status === "banned" || user.sessionVersion !== data.sv) return null;
  return user;
}

export async function requireUser(req) {
  const user = await getSessionUser(req);
  if (!user) throw new HttpError(401, "Oturumunuz sona erdi, lütfen tekrar giriş yapın.");
  return user;
}

const maxAge = SESSION_DAYS * 86400;
export const userCookies = (req, token) => [
  cookie(req, COOKIE, token, { maxAge, sameSite: "Lax" }),
  cookie(req, HINT_COOKIE, "1", { maxAge, sameSite: "Lax", httpOnly: false }),
];
export const clearedUserCookies = (req) => [
  cookie(req, COOKIE, "", { maxAge: 0, sameSite: "Lax" }),
  cookie(req, HINT_COOKIE, "", { maxAge: 0, sameSite: "Lax", httpOnly: false }),
];
