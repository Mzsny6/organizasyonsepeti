import {
  clearedCookie,
  countHit,
  createSessionToken,
  isAuthenticated,
  isLimited,
  requireAdmin,
  resetHits,
  sessionCookie,
  setPassword,
  verifyPassword,
} from "../lib/auth.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";

const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;

export default async (req, context) => {
  try {
    const path = new URL(req.url).pathname;

    if (path === "/api/me" && req.method === "GET") {
      return json({ authenticated: await isAuthenticated(req) });
    }

    if (path === "/api/login" && req.method === "POST") {
      if (await isLimited("login", context.ip, LOGIN_MAX_FAILURES, LOGIN_WINDOW)) {
        return fail(429, "Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
      }
      const { password } = await readJson(req, 2048);
      if (typeof password !== "string" || !password) return fail(400, "Lütfen şifrenizi girin.");
      if (!(await verifyPassword(password))) {
        await countHit("login", context.ip, LOGIN_WINDOW);
        await new Promise((r) => setTimeout(r, 700));
        return fail(401, "Şifre hatalı.");
      }
      await resetHits("login", context.ip);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(req, await createSessionToken()) });
    }

    if (path === "/api/logout" && req.method === "POST") {
      return json({ ok: true }, 200, { "Set-Cookie": clearedCookie(req) });
    }

    if (path === "/api/password" && req.method === "POST") {
      await requireAdmin(req);
      const { current, next } = await readJson(req, 2048);
      if (typeof current !== "string" || !(await verifyPassword(current))) return fail(400, "Mevcut şifre hatalı.");
      if (typeof next !== "string" || next.length < 8) return fail(400, "Yeni şifre en az 8 karakter olmalı.");
      await setPassword(next);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(req, await createSessionToken()) });
    }

    return fail(404, "Bulunamadı.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: ["/api/login", "/api/logout", "/api/me", "/api/password"] };
