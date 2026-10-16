// Üye hesabı: kayıt, giriş, profil; organizatörler için ilanlar, paketler, dopingler, takvim ve kara liste.
import { recordEvent } from "../lib/analytics.mjs";
import { isAdmin } from "../lib/auth.mjs";
import { reportPhone } from "../lib/blacklist.mjs";
import {
  BOOKING_ID,
  agendaSettings,
  deleteBooking,
  deleteUserBookings,
  disableIcs,
  listBookings,
  resetIcsToken,
  saveBooking,
  updateAgendaSettings,
} from "../lib/bookings.mjs";
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
import { createOrder, listOrders, quote } from "../lib/orders.mjs";
import { priceTable } from "../lib/pricing.mjs";
import {
  REQUEST_ID,
  countNewRequests,
  deleteRequest,
  deleteUserRequests,
  listRequests,
  listSentRequests,
  updateRequest,
} from "../lib/requests.mjs";
import { REVIEW_ID, deleteUserReviews, publishedReviews, replyReview } from "../lib/reviews.mjs";
import { sendOtp, smsConfigured, verifyOtp } from "../lib/sms.mjs";
import { statsFor } from "../lib/stats.mjs";
import {
  authenticate,
  clearedUserCookies,
  createUser,
  createUserToken,
  deleteUserRecord,
  findUserByEmail,
  normalizeEmail,
  publicUser,
  requireOrganizer,
  requireUser,
  saveUser,
  setUserPassword,
  userCookies,
  validatePassword,
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
  await Promise.all([countHit("register", context.ip, HOUR), recordEvent("signup")]);
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

// Şifremi unuttum: hesaba kayıtlı ve SMS ile doğrulanmış telefona kod gönderilir.
// Yanıt her durumda aynıdır; böylece hangi e-postanın kayıtlı olduğu anlaşılmaz.
async function resetStart(req, context) {
  if (!smsConfigured()) {
    return fail(503, "SMS servisi şu an kapalı. Şifrenizi sıfırlamak için iletişim sayfasından bize yazın.");
  }
  const email = normalizeEmail((await readJson(req, 1024)).email);
  if ((await isLimited("reset-ip", context.ip, 10, HOUR)) || (await isLimited("reset-email", email, 3, HOUR))) {
    return fail(429, "Çok fazla deneme yapıldı. Lütfen bir saat sonra tekrar deneyin.");
  }
  await countHit("reset-ip", context.ip, HOUR);
  await countHit("reset-email", email, HOUR);
  const user = await findUserByEmail(email);
  if (user && (user.role || "organizer") === "organizer" && user.verifiedPhone && user.status !== "banned") {
    await sendOtp(user.verifiedPhone, context.ip).catch((err) => console.warn("Şifre sıfırlama SMS'i:", err.message));
  }
  return json({ ok: true });
}

async function resetFinish(req, context) {
  const body = await readJson(req, 2048);
  if (await isLimited("reset-finish", context.ip, 20, HOUR))
    return fail(429, "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.");
  await countHit("reset-finish", context.ip, HOUR);
  validatePassword(body.password);
  const email = normalizeEmail(body.email);
  const user = await findUserByEmail(email);
  if (!user || (user.role || "organizer") !== "organizer" || !user.verifiedPhone) {
    return fail(400, "Kodun süresi dolmuş. Lütfen yeni kod isteyin.");
  }
  await verifyOtp(user.verifiedPhone, body.code);
  if (user.status === "banned") return fail(403, "Hesabınız askıya alınmıştır. Bilgi için bizimle iletişime geçin.");
  await setUserPassword(user, body.password);
  await resetHits("user-login-email", email);
  return loggedIn(req, user);
}

async function myListings(user) {
  const mine = (await readIndex())
    .filter((x) => x.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ text, userId, ...rest }) => rest);
  const stats = await statsFor(mine.map((x) => x.id));
  return mine.map((x) => ({ ...x, stats: stats[x.id] }));
}

async function ownListing(user, id) {
  const listing = await getListing(id);
  return listing && listing.userId === user.id ? listing : null;
}

async function listingRoutes(req, user, content, rest) {
  const [id, action] = rest;
  const method = req.method;

  if (!id && method === "POST") {
    if (await isLimited("listing-create", user.id, 15, DAY)) {
      return fail(429, "Bugün için ilan oluşturma sınırına ulaştınız. Yarın tekrar deneyin.");
    }
    const body = await readJson(req, 64 * 1024);
    // Önce fiyat kontrol edilir; paket ya da kod geçersizse ilan oluşturulmaz.
    await quote(content, {
      category: body.category,
      type: "package",
      item: body.package,
      promoCode: body.promo,
      userId: user.id,
    });
    const listing = await createListing(user, body, content, { adminSession: await isAdmin(req) });
    await Promise.all([countHit("listing-create", user.id, DAY), recordEvent("listing")]);
    const order = await createOrder(content, user, listing, {
      type: "package",
      item: body.package,
      promoCode: body.promo,
    });
    return json({ listing: await getListing(listing.id), order }, 201);
  }

  const listing = id && (await ownListing(user, id));
  if (!listing) return fail(404, "İlan bulunamadı.");

  if (!action && method === "GET") return json({ listing });
  if (!action && method === "PUT") {
    await updateListing(user, listing, await readJson(req, 64 * 1024), content, { adminSession: await isAdmin(req) });
    await purgeSite();
    return json({ listing });
  }
  if (!action && method === "DELETE") {
    await deleteListing(listing);
    await purgeSite();
    return json({ ok: true });
  }
  if (action === "status" && method === "POST") {
    const { active } = await readJson(req, 1024);
    await setOwnerActive(listing, Boolean(active));
    await purgeSite();
    return json({ listing });
  }
  // Paket yenileme ve doping satın alma
  if ((action === "renew" || action === "doping") && method === "POST") {
    const body = await readJson(req, 2048);
    const order = await createOrder(content, user, listing, {
      type: action === "renew" ? "package" : "doping",
      item: action === "renew" ? body.package : body.doping,
      promoCode: action === "renew" ? body.promo : "",
    });
    await purgeSite();
    return json({ order, listing: await getListing(listing.id) }, 201);
  }
  return fail(404, "Bulunamadı.");
}

async function bookingRoutes(req, user, rest) {
  const [id] = rest;
  if (!id && req.method === "GET") return json({ bookings: await listBookings(user.id) });
  if (id && !BOOKING_ID.test(id)) return fail(404, "Kayıt bulunamadı.");
  if (req.method === "DELETE" && id) {
    await deleteBooking(user, id);
    await purgeSite();
    return json({ ok: true });
  }
  if ((req.method === "POST" && !id) || (req.method === "PUT" && id)) {
    const body = await readJson(req, 8192);
    const listingIds = (await readIndex()).filter((x) => x.userId === user.id).map((x) => x.id);
    const result = await saveBooking(user, body, { id, listingIds, force: Boolean(body.force) });
    if (result.conflicts)
      return json({ error: "Bu tarihte başka bir kaydınız var.", conflicts: result.conflicts }, 409);
    await purgeSite(); // ilandaki dolu günler güncellensin
    return json(result, id ? 200 : 201);
  }
  return fail(404, "Bulunamadı.");
}

export default async (req, context) => {
  try {
    const [section, ...rest] = new URL(req.url).pathname
      .replace(/^\/api\/account\/?/, "")
      .split("/")
      .filter(Boolean);
    const method = req.method;

    if (section === "register" && method === "POST") return await register(req, context);
    if (section === "login" && method === "POST") return await login(req, context);
    if (section === "reset" && rest[0] === "start" && method === "POST") return await resetStart(req, context);
    if (section === "reset" && rest[0] === "finish" && method === "POST") return await resetFinish(req, context);
    if (section === "logout" && method === "POST")
      return json({ ok: true }, 200, { "Set-Cookie": clearedUserCookies(req) });

    const user = await requireUser(req);
    const content = await getContent();

    if (section === "me" && method === "GET") {
      const organizer = (user.role || "organizer") === "organizer";
      return json({
        user: publicUser(user),
        listings: organizer ? await myListings(user) : [],
        pricing: organizer ? priceTable(content) : null,
        newRequests: organizer ? await countNewRequests(user.id) : 0,
      });
    }

    // Üyenin gönderdiği teklif talepleri (ziyaretçi ya da organizatör)
    if (section === "sent-requests" && method === "GET") return json({ requests: await listSentRequests(user.id) });

    if (!section && method === "DELETE") {
      const { password } = await readJson(req, 2048);
      if (user.password && !(await checkPassword(String(password || ""), user.password)))
        return fail(400, "Şifre hatalı.");
      await deleteUserListings(user.id);
      await deleteUserBookings(user.id);
      await deleteUserRequests(user.id);
      await deleteUserReviews(user.id);
      await deleteUserRecord(user);
      await purgeSite();
      return json({ ok: true }, 200, { "Set-Cookie": clearedUserCookies(req) });
    }

    // Buradan sonrası yalnızca organizatör hesapları içindir.
    requireOrganizer(user);

    if (section === "profile" && method === "PUT") {
      const previousCompany = user.company;
      Object.assign(user, validateProfile(await readJson(req, 4096)));
      await saveUser(user);
      if (user.company !== previousCompany) {
        await renameCompany(user);
        await purgeSite();
      }
      return json({ user: publicUser(user) });
    }

    if (section === "password" && method === "POST") {
      const { current, next } = await readJson(req, 2048);
      if (!(await checkPassword(String(current || ""), user.password))) return fail(400, "Mevcut şifre hatalı.");
      await setUserPassword(user, next);
      return loggedIn(req, user);
    }

    if (section === "quote" && method === "POST") {
      const body = await readJson(req, 2048);
      return json({ quote: await quote(content, { ...body, promoCode: body.promo, userId: user.id }) });
    }

    if (section === "orders" && method === "GET") return json({ orders: await listOrders({ userId: user.id }) });
    if (section === "listings") return await listingRoutes(req, user, content, rest);
    if (section === "bookings") return await bookingRoutes(req, user, rest);

    // Ajanda ayarları: günlük kapasite ve telefon takvimine (Google / iPhone) abonelik bağlantısı
    if (section === "agenda") {
      const siteUrl = content.settings.siteUrl;
      if (!rest[0] && method === "GET") return json(agendaSettings(user, siteUrl));
      if (!rest[0] && method === "PUT") {
        await updateAgendaSettings(user, await readJson(req, 1024));
        await purgeSite(); // kapasite ilandaki dolu günleri etkiler
        return json(agendaSettings(user, siteUrl));
      }
      if (rest[0] === "ics" && method === "POST") return json(agendaSettings(await resetIcsToken(user), siteUrl));
      if (rest[0] === "ics" && method === "DELETE") return json(agendaSettings(await disableIcs(user), siteUrl));
      return fail(404, "Bulunamadı.");
    }

    // Firmanın yayındaki değerlendirmeleri ve yanıt
    if (section === "reviews") {
      const [id, action] = rest;
      if (!id && method === "GET") return json({ reviews: await publishedReviews(user.id) });
      if (REVIEW_ID.test(id || "") && action === "reply" && method === "POST") {
        const review = await replyReview(user.id, id, (await readJson(req, 4096)).text);
        await purgeSite();
        return json({ review });
      }
      return fail(404, "Bulunamadı.");
    }

    if (section === "requests") {
      const [id] = rest;
      if (!id && method === "GET") return json({ requests: await listRequests(user.id) });
      if (!REQUEST_ID.test(id || "")) return fail(404, "Talep bulunamadı.");
      if (method === "PUT") return json({ request: await updateRequest(user.id, id, await readJson(req, 4096)) });
      if (method === "DELETE") {
        await deleteRequest(user.id, id);
        return json({ ok: true });
      }
    }

    if (section === "blacklist" && method === "POST") {
      if (await isLimited("blacklist-report", user.id, 20, DAY))
        return fail(429, "Bugün için bildirim sınırına ulaştınız.");
      const result = await reportPhone(user, await readJson(req, 4096), content.security.blacklistThreshold);
      await countHit("blacklist-report", user.id, DAY);
      return json(result, 201);
    }

    return fail(404, "Bulunamadı.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: ["/api/account", "/api/account/*"] };
