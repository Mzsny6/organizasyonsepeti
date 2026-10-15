// PRD v3.0 REST uç noktaları (web ve Android uygulaması ortak kullanır).
//
//   POST /api/v1/auth/send-otp           { phone }                 SMS doğrulama kodu gönderir
//   POST /api/v1/auth/verify-otp         { phone, code }           Kodu doğrular, oturum açar
//   GET  /api/v1/auth/status                                       Doğrulama durumu ve iletişim bariyeri
//   GET  /api/v1/meta                                              Kategoriler, etkinlikler, fiyatlar
//   GET  /api/v1/listings                ?kategori&etkinlik&il&ilce&min&max&q&sirala&sayfa
//   GET  /api/v1/listings/:id
//   GET  /api/v1/listings/:id/contact    ?type=phone|whatsapp      İletişim bilgisi (+ tıklama sayacı)
//   POST /api/v1/listings/:id/report     { reason, message }       İlan şikâyeti
//   POST /api/v1/listings/:id/request    { name, eventDate, guests, event, message, phone? }  Teklif talebi
//   GET  /api/v1/firms/:id/reviews                                 Firmanın yayındaki değerlendirmeleri
//   POST /api/v1/firms/:id/reviews       { rating, comment, name } Değerlendirme (teklif istemiş, doğrulanmış müşteri)
//   POST /api/v1/promotions/apply        { code, package, category } İndirimli fiyatı hesaplar
//   POST /api/v1/analytics/click         { listingId, type }       İletişim butonu tıklaması
//   POST /api/v1/analytics/view          { listingId }             İlan görüntülenmesi
//   POST /api/v1/analytics/pageview      { path, ref, utm, q }     Sayfa görüntüleme (anonim site istatistiği)
//   GET  /api/v1/organizer/calendar      ?listing=:id              İlandaki dolu günler (ya da kendi takviminiz)
//   POST /api/v1/reports/blacklist       { phone, reason, note }   Kötü niyetli müşteri ihbarı (organizatör)
import { CITIES } from "../../public/assets/js/locations.js";
import { recordEvent, recordPageview } from "../lib/analytics.mjs";
import { isBlacklisted, reportPhone } from "../lib/blacklist.mjs";
import { busyDays, listBookings } from "../lib/bookings.mjs";
import { getContent } from "../lib/content.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";
import { DAY, HOUR, countHit, isLimited } from "../lib/limits.mjs";
import { createReport, getListing, isLive, listingPath, readIndex, searchIndex } from "../lib/listings.mjs";
import { quote } from "../lib/orders.mjs";
import { priceTable } from "../lib/pricing.mjs";
import { parseSearch } from "../lib/render/search.mjs";
import { createRequest } from "../lib/requests.mjs";
import { createReview, publishedReviews, ratingSummary } from "../lib/reviews.mjs";
import { sendNotice, sendOtp, smsConfigured, verifyOtp } from "../lib/sms.mjs";
import { CLICK_TYPES, countClick } from "../lib/stats.mjs";
import {
  createUserToken,
  findOrCreateClient,
  getSessionUser,
  getUser,
  maskPhone,
  normalizeMobile,
  publicUser,
  requireOrganizer,
  requireUser,
  saveUser,
  userCookies,
} from "../lib/users.mjs";

const BOT_UA = /bot|crawl|spider|slurp|preview|lighthouse|headless|facebookexternalhit|whatsapp/i;

const contactGateOn = (content) => content.security.contactGate && smsConfigured();

// İlanın herkese açık alanları (telefon numarası yer almaz).
const publicListing = (l) => ({
  id: l.id,
  url: listingPath(l),
  title: l.title,
  category: l.category,
  events: l.events || [],
  city: l.city,
  district: l.district,
  priceMin: l.priceMin,
  priceNote: l.priceNote,
  description: l.description,
  images: l.images,
  company: l.company,
  whatsapp: Boolean(l.whatsapp),
  instagram: l.instagram,
  showCalendar: Boolean(l.showCalendar),
  publishedAt: l.publishedAt,
});

async function auth(req, context, action, content) {
  if (action === "status" && req.method === "GET") {
    const user = await getSessionUser(req);
    return json({ gate: contactGateOn(content), verified: Boolean(user?.phoneVerified), role: user?.role || null });
  }
  if (action === "send-otp" && req.method === "POST") {
    if (!smsConfigured()) return fail(503, "SMS doğrulama şu an kullanılamıyor.");
    const mobile = normalizeMobile((await readJson(req, 1024)).phone);
    if (!mobile) return fail(400, "Lütfen 05xx ile başlayan cep telefonu numaranızı yazın.");
    if (await isBlacklisted(mobile))
      return fail(403, "Bu numara kötüye kullanım bildirimleri nedeniyle engellenmiştir.");
    await sendOtp(mobile, context.ip);
    return json({ ok: true, sentTo: `0${mobile.slice(2, 5)} *** ** ${mobile.slice(-2)}` });
  }
  if (action === "verify-otp" && req.method === "POST") {
    const body = await readJson(req, 1024);
    const mobile = normalizeMobile(body.phone);
    if (!mobile) return fail(400, "Telefon numarası geçersiz.");
    await verifyOtp(mobile, body.code);
    if (await isBlacklisted(mobile))
      return fail(403, "Bu numara kötüye kullanım bildirimleri nedeniyle engellenmiştir.");

    let user = await getSessionUser(req);
    if (user && (user.role || "organizer") === "organizer") {
      // Giriş yapmış organizatör kendi numarasını doğruluyor
      Object.assign(user, { phoneVerified: true, verifiedPhone: mobile });
      await saveUser(user);
    } else {
      user = await findOrCreateClient(mobile);
      if (user.status === "banned") return fail(403, "Bu numara engellenmiştir.");
    }
    return json({ user: publicUser(user) }, 200, { "Set-Cookie": userCookies(req, await createUserToken(user)) });
  }
  return fail(404, "Bulunamadı.");
}

// Teklif talebi: iletişim bariyeri açıksa yalnızca SMS ile doğrulanmış numaralar gönderebilir.
async function sendRequest(req, context, listing, content) {
  const body = await readJson(req, 8192);
  if (body.website) return json({ ok: true }, 201); // bot tuzağı
  const sender = await getSessionUser(req);
  if (sender && sender.id === listing.userId) return fail(400, "Kendi ilanınıza teklif talebi gönderemezsiniz.");
  let mobile = sender?.phoneVerified ? sender.verifiedPhone : "";
  if (!mobile) {
    if (contactGateOn(content)) {
      return json({ error: "Talep göndermek için telefon numaranızı doğrulayın.", needsVerification: true }, 403);
    }
    mobile = normalizeMobile(body.phone);
    if (!mobile) return fail(400, "Lütfen 05xx ile başlayan cep telefonu numaranızı yazın.");
  }
  if (await isBlacklisted(mobile))
    return fail(403, "Telefon numaranız kötüye kullanım bildirimleri nedeniyle engellenmiştir.");
  if (
    (await isLimited("request-ip", context.ip, 20, DAY)) ||
    (await isLimited("request-phone", mobile, 10, DAY)) ||
    (await isLimited("request-listing", `${mobile}:${listing.id}`, 1, DAY))
  ) {
    return fail(429, "Bu ilana bugün zaten talep gönderdiniz ya da günlük talep sınırına ulaştınız.");
  }
  await createRequest(listing, { sender, mobile, phoneVerified: Boolean(sender?.phoneVerified) }, body, content);
  await Promise.all([
    countHit("request-ip", context.ip, DAY),
    countHit("request-phone", mobile, DAY),
    countHit("request-listing", `${mobile}:${listing.id}`, DAY),
    countClick(listing.id, "request"),
    recordEvent("request"),
  ]);
  if (content.security.requestSms) {
    const owner = await getUser(listing.userId);
    const site = content.settings.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    await sendNotice(
      owner?.verifiedPhone,
      `${content.settings.siteName}: "${listing.title.slice(0, 40)}" ilanınız için yeni teklif talebi var. ${site}/hesap/#talepler`,
    );
  }
  return json({ ok: true, company: listing.company, phone: maskPhone(mobile) }, 201);
}

async function firmReviews(req, id) {
  const organizer = await getUser(id);
  if (!organizer || (organizer.role || "organizer") !== "organizer" || organizer.status === "banned") {
    return fail(404, "Firma bulunamadı.");
  }
  if (req.method === "GET") {
    const [reviews, summary] = await Promise.all([publishedReviews(organizer.id), ratingSummary()]);
    return json({
      summary: summary[organizer.id] || null,
      reviews: reviews.map(({ id: reviewId, authorName, rating, comment, reply, replyAt, createdAt }) => ({
        id: reviewId,
        authorName,
        rating,
        comment,
        reply,
        replyAt,
        createdAt,
      })),
    });
  }
  if (req.method === "POST") {
    const author = await getSessionUser(req);
    if (!author?.phoneVerified) {
      return json({ error: "Değerlendirme yazmak için telefon numaranızı doğrulayın.", needsVerification: true }, 403);
    }
    if (await isBlacklisted(author.verifiedPhone))
      return fail(403, "Telefon numaranız kötüye kullanım bildirimleri nedeniyle engellenmiştir.");
    if (await isLimited("review", author.id, 5, DAY)) return fail(429, "Bugün için değerlendirme sınırına ulaştınız.");
    const body = await readJson(req, 4096);
    if (body.website) return json({ ok: true }, 201);
    await createReview(organizer, author, body);
    await Promise.all([countHit("review", author.id, DAY), recordEvent("review")]);
    return json({ ok: true, status: "pending" }, 201);
  }
  return fail(404, "Bulunamadı.");
}

async function listingRoute(req, context, id, action, content) {
  const listing = await getListing(id);
  if (!listing || !isLive(listing)) return fail(404, "İlan bulunamadı ya da yayında değil.");

  if (!action && req.method === "GET") return json({ listing: publicListing(listing) });

  if (action === "contact" && req.method === "GET") {
    if (contactGateOn(content)) {
      const viewer = await getSessionUser(req);
      if (!viewer?.phoneVerified) {
        return json(
          { error: "İletişim bilgilerini görmek için telefon numaranızı doğrulayın.", needsVerification: true },
          403,
        );
      }
      if (await isBlacklisted(viewer.verifiedPhone)) {
        return fail(403, "Telefon numaranız kötüye kullanım bildirimleri nedeniyle engellenmiştir.");
      }
    }
    if (await isLimited("contact", context.ip, 120, HOUR))
      return fail(429, "Çok fazla istek yapıldı. Lütfen biraz sonra tekrar deneyin.");
    await countHit("contact", context.ip, HOUR);
    const type = new URL(req.url).searchParams.get("type");
    if (type === "phone" || type === "whatsapp") await Promise.all([countClick(listing.id, type), recordEvent(type)]);
    let whatsapp = "";
    if (listing.whatsapp) {
      whatsapp = listing.phone.replace(/\D/g, "");
      if (/^0\d{10}$/.test(whatsapp)) whatsapp = `9${whatsapp}`;
    }
    return json({ phone: listing.phone, whatsapp, instagram: listing.instagram });
  }

  if (action === "request" && req.method === "POST") return await sendRequest(req, context, listing, content);

  if (action === "report" && req.method === "POST") {
    if (await isLimited("report", context.ip, 5, HOUR)) {
      return fail(429, "Kısa sürede çok fazla bildirim gönderildi. Lütfen daha sonra tekrar deneyin.");
    }
    const body = await readJson(req, 4096);
    if (body.website) return json({ ok: true }, 201);
    await createReport(listing, body);
    await countHit("report", context.ip, HOUR);
    return json({ ok: true }, 201);
  }
  return fail(404, "Bulunamadı.");
}

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const [resource, id, action] = url.pathname
      .replace(/^\/api\/v1\/?/, "")
      .split("/")
      .filter(Boolean);
    const content = await getContent();

    if (resource === "auth") return await auth(req, context, id, content);

    if (resource === "meta" && req.method === "GET") {
      return json({
        categories: content.categories,
        events: content.events,
        cities: CITIES,
        pricing: priceTable(content),
        contactGate: contactGateOn(content),
      });
    }

    if (resource === "listings" && !id && req.method === "GET") {
      const v = parseSearch(content, url.searchParams);
      const result = searchIndex(await readIndex(), {
        category: v.category?.id,
        event: v.event?.id,
        city: v.il,
        district: v.ilce,
        q: v.q,
        min: v.min,
        max: v.max,
        sort: v.sirala,
        page: v.sayfa,
      });
      return json({
        ...result,
        items: result.items.map(({ text, userId, rejectReason, credit, awaitingOrder, ...x }) => ({
          ...x,
          url: listingPath(x),
        })),
      });
    }
    if (resource === "listings" && id) return await listingRoute(req, context, id, action, content);

    if (resource === "firms" && id && action === "reviews") return await firmReviews(req, id);

    if (resource === "promotions" && id === "apply" && req.method === "POST") {
      const body = await readJson(req, 1024);
      const user = await getSessionUser(req);
      if (await isLimited("promo-check", context.ip, 30, HOUR)) return fail(429, "Çok fazla deneme yapıldı.");
      await countHit("promo-check", context.ip, HOUR);
      const q = await quote(content, {
        category: body.category,
        type: "package",
        item: body.package,
        promoCode: body.code,
        userId: user?.id,
      });
      return json({ quote: q });
    }

    if (resource === "analytics" && id === "click" && req.method === "POST") {
      const { listingId, type } = await readJson(req, 512);
      if (!CLICK_TYPES.includes(type)) return fail(400, "Geçersiz tıklama türü.");
      const listing = await getListing(listingId);
      if (!listing || !isLive(listing)) return fail(404, "İlan bulunamadı.");
      if (await isLimited("click", `${context.ip}:${listingId}:${type}`, 3, DAY)) return json({ ok: true });
      await countHit("click", `${context.ip}:${listingId}:${type}`, DAY);
      await Promise.all([countClick(listing.id, type), recordEvent(type)]);
      return json({ ok: true });
    }

    // Site geneli ziyaret istatistiği (çerezsiz, IP saklanmaz; bkz. lib/analytics.mjs)
    if (resource === "analytics" && id === "pageview" && req.method === "POST") {
      const ua = req.headers.get("user-agent") || "";
      if (BOT_UA.test(ua) || (await isLimited("pageview", context.ip, 600, HOUR))) return json({ ok: true });
      await countHit("pageview", context.ip, HOUR);
      await recordPageview(await readJson(req, 2048), {
        ip: context.ip,
        ua,
        geo: context.geo,
        siteHost: url.hostname,
      });
      return json({ ok: true });
    }

    // Görüntülenme: tarayıcı aynı ilanı günde bir kez bildirir; botlar ve aşırı istekler sayılmaz.
    if (resource === "analytics" && id === "view" && req.method === "POST") {
      const { listingId } = await readJson(req, 256);
      if (BOT_UA.test(req.headers.get("user-agent") || "")) return json({ ok: true });
      if (await isLimited("view", context.ip, 300, HOUR)) return json({ ok: true });
      const listing = await getListing(listingId);
      if (!listing || !isLive(listing)) return fail(404, "İlan bulunamadı.");
      await countHit("view", context.ip, HOUR);
      await countClick(listing.id, "view");
      return json({ ok: true });
    }

    if (resource === "organizer" && id === "calendar" && req.method === "GET") {
      const listingId = url.searchParams.get("listing");
      if (listingId) {
        const listing = await getListing(listingId);
        if (!listing || !isLive(listing) || !listing.showCalendar) return fail(404, "Bu ilanın takvimi paylaşılmıyor.");
        return json({ busy: await busyDays(listing.userId) });
      }
      const user = requireOrganizer(await requireUser(req));
      return json({ bookings: await listBookings(user.id), busy: await busyDays(user.id) });
    }

    if (resource === "reports" && id === "blacklist" && req.method === "POST") {
      const user = requireOrganizer(await requireUser(req));
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

export const config = { path: "/api/v1/*" };
