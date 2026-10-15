// Yönetim paneli girişi.
import {
  adminCookie,
  clearedAdminCookie,
  createAdminToken,
  isAdmin,
  requireAdmin,
  setAdminPassword,
  verifyAdminPassword,
} from "../lib/auth.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";
import { MINUTE, countHit, isLimited, resetHits } from "../lib/limits.mjs";

const LOGIN_WINDOW = 15 * MINUTE;
const LOGIN_MAX_FAILURES = 8;

export default async (req, context) => {
  try {
    const path = new URL(req.url).pathname;

    if (path === "/api/me" && req.method === "GET") {
      return json({ authenticated: await isAdmin(req) });
    }

    if (path === "/api/login" && req.method === "POST") {
      if (await isLimited("login", context.ip, LOGIN_MAX_FAILURES, LOGIN_WINDOW)) {
        return fail(429, "Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
      }
      const { password } = await readJson(req, 2048);
      if (typeof password !== "string" || !password) return fail(400, "Lütfen şifrenizi girin.");
      if (!(await verifyAdminPassword(password))) {
        await countHit("login", context.ip, LOGIN_WINDOW);
        await new Promise((r) => setTimeout(r, 700));
        return fail(401, "Şifre hatalı.");
      }
      await resetHits("login", context.ip);
      return json({ ok: true }, 200, { "Set-Cookie": adminCookie(req, await createAdminToken()) });
    }

    if (path === "/api/logout" && req.method === "POST") {
      return json({ ok: true }, 200, { "Set-Cookie": clearedAdminCookie(req) });
    }

    if (path === "/api/password" && req.method === "POST") {
      await requireAdmin(req);
      const { current, next } = await readJson(req, 2048);
      if (typeof current !== "string" || !(await verifyAdminPassword(current)))
        return fail(400, "Mevcut şifre hatalı.");
      if (typeof next !== "string" || next.length < 8) return fail(400, "Yeni şifre en az 8 karakter olmalı.");
      await setAdminPassword(next);
      return json({ ok: true }, 200, { "Set-Cookie": adminCookie(req, await createAdminToken()) });
    }

    return fail(404, "Bulunamadı.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: ["/api/login", "/api/logout", "/api/me", "/api/password"] };
