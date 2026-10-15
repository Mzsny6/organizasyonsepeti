// Üye (ilan veren firma) hesabı: kayıt, giriş, profil ve ilan yönetimi.
import { purgeSite } from "../lib/cache.mjs";
import { getContent } from "../lib/content.mjs";
import { checkPassword } from "../lib/crypto.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";
import { DAY, HOUR, MINUTE, countHit, isLimited, resetHits } from "../lib/limits.mjs";
import {
  createListing,
  deleteListing,
  deleteUserListings,
  getListing,
  readIndex,
  renameCompany,
  setOwnerActive,
  updateListing,
} from "../lib/listings.mjs";
import {
  authenticate,
  clearedUserCookies,
  createUser,
  createUserToken,
  deleteUserRecord,
  normalizeEmail,
  publicUser,
  requireUser,
  saveUser,
  setUserPassword,
  userCookies,
  validateProfile,
} from "../lib/users.mjs";

const loggedIn = async (req, user, status = 200) =>
  json({ user: publicUser(user) }, status, { "Set-Cookie": userCookies(req, await createUserToken(user)) });

async function register(req, context) {
  if (await isLimited("register", context.ip, 5, HOUR)) {
    return fail(429, "Kısa sürede çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.");
  }
  const body = await readJson(req, 4096);
  if (body.website) return fail(400, "Kayıt tamamlanamadı."); // bot tuzağı
  const user = await createUser(body);
  await countHit("register", context.ip, HOUR);
  return loggedIn(req, user, 201);
}

async function login(req, context) {
  const body = await readJson(req, 2048);
  const email = normalizeEmail(body.email);
  if (
    (await isLimited("user-login", context.ip, 20, 15 * MINUTE)) ||
    (await isLimited("user-login-email", email, 8, 15 * MINUTE))
  ) {
    return fail(429, "Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
  }
  try {
    const user = await authenticate(email, String(body.password || ""));
    await resetHits("user-login-email", email);
    return loggedIn(req, user);
  } catch (err) {
    if (err.status === 401) {
      await countHit("user-login", context.ip, 15 * MINUTE);
      await countHit("user-login-email", email, 15 * MINUTE);
    }
    throw err;
  }
}

async function myListings(user) {
  return (await readIndex())
    .filter((x) => x.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ text, userId, ...rest }) => rest);
}

async function ownListing(user, id) {
  const listing = await getListing(id);
  if (!listing || listing.userId !== user.id) return null;
  return listing;
}

export default async (req, context) => {
  try {
    const path = new URL(req.url).pathname.replace(/^\/api\/account/, "") || "/";
    const method = req.method;

    if (path === "/register" && method === "POST") return await register(req, context);
    if (path === "/login" && method === "POST") return await login(req, context);
    if (path === "/logout" && method === "POST")
      return json({ ok: true }, 200, { "Set-Cookie": clearedUserCookies(req) });

    const user = await requireUser(req);
    const { categories } = await getContent();

    if (path === "/me" && method === "GET") {
      return json({ user: publicUser(user), listings: await myListings(user) });
    }

    if (path === "/profile" && method === "PUT") {
      const previousCompany = user.company;
      Object.assign(user, validateProfile(await readJson(req, 4096)));
      await saveUser(user);
      if (user.company !== previousCompany) {
        await renameCompany(user);
        await purgeSite();
      }
      return json({ user: publicUser(user) });
    }

    if (path === "/password" && method === "POST") {
      const { current, next } = await readJson(req, 2048);
      if (!(await checkPassword(String(current || ""), user.password))) return fail(400, "Mevcut şifre hatalı.");
      await setUserPassword(user, next);
      return loggedIn(req, user);
    }

    if (path === "/" && method === "DELETE") {
      const { password } = await readJson(req, 2048);
      if (!(await checkPassword(String(password || ""), user.password))) return fail(400, "Şifre hatalı.");
      await deleteUserListings(user.id);
      await deleteUserRecord(user);
      await purgeSite();
      return json({ ok: true }, 200, { "Set-Cookie": clearedUserCookies(req) });
    }

    if (path === "/listings" && method === "POST") {
      if (await isLimited("listing-create", user.id, 15, DAY)) {
        return fail(429, "Bugün için ilan oluşturma sınırına ulaştınız. Yarın tekrar deneyin.");
      }
      const listing = await createListing(user, await readJson(req, 64 * 1024), categories);
      await countHit("listing-create", user.id, DAY);
      return json({ listing }, 201);
    }

    const match = /^\/listings\/([a-f0-9]{10})(\/status)?$/.exec(path);
    if (match) {
      const listing = await ownListing(user, match[1]);
      if (!listing) return fail(404, "İlan bulunamadı.");

      if (!match[2] && method === "GET") return json({ listing });
      if (!match[2] && method === "PUT") {
        await updateListing(user, listing, await readJson(req, 64 * 1024), categories);
        await purgeSite();
        return json({ listing });
      }
      if (!match[2] && method === "DELETE") {
        await deleteListing(listing);
        await purgeSite();
        return json({ ok: true });
      }
      if (match[2] && method === "POST") {
        const { active } = await readJson(req, 1024);
        await setOwnerActive(listing, Boolean(active));
        await purgeSite();
        return json({ listing });
      }
    }

    return fail(404, "Bulunamadı.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: ["/api/account", "/api/account/*"] };
