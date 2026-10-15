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
//   POST /api/v1/promotions/apply        { code, package, category } İndirimli fiyatı hesaplar
//   POST /api/v1/analytics/click         { listingId, type }       İletişim butonu tıklaması
//   GET  /api/v1/organizer/calendar      ?listing=:id              İlandaki dolu günler (ya da kendi takviminiz)
//   POST /api/v1/reports/blacklist       { phone, reason, note }   Kötü niyetli müşteri ihbarı (organizatör)
import { CITIES } from "../../public/assets/js/locations.js";
import { isBlacklisted, reportPhone } from "../lib/blacklist.mjs";
import { busyDays, listBookings } from "../lib/bookings.mjs";
import { getContent } from "../lib/content.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";
import { DAY, HOUR, countHit, isLimited } from "../lib/limits.mjs";
import { createReport, getListing, isLive, listingPath, readIndex, searchIndex } from "../lib/listings.mjs";
import { quote } from "../lib/orders.mjs";
import { priceTable } from "../lib/pricing.mjs";
import { parseSearch } from "../lib/render/search.mjs";
import { sendOtp, smsConfigured, verifyOtp } from "../lib/sms.mjs";
import { countClick } from "../lib/stats.mjs";
import {
  createUserToken,
  findOrCreateClient,
  getSessionUser,
  normalizeMobile,
  publicUser,
  requireOrganizer,
  requireUser,
  saveUser,
  userCookies,
} from "../lib/users.mjs";

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
    if (type === "phone" || type === "whatsapp") await countClick(listing.id, type);
    let whatsapp = "";
    if (listing.whatsapp) {
      whatsapp = listing.phone.replace(/\D/g, "");
      if (/^0\d{10}$/.test(whatsapp)) whatsapp = `9${whatsapp}`;
    }
    return json({ phone: listing.phone, whatsapp, instagram: listing.instagram });
  }

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
      const listing = await getListing(listingId);
      if (!listing || !isLive(listing)) return fail(404, "İlan bulunamadı.");
      if (await isLimited("click", `${context.ip}:${listingId}:${type}`, 3, DAY)) return json({ ok: true });
      await countHit("click", `${context.ip}:${listingId}:${type}`, DAY);
      await countClick(listing.id, type);
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
