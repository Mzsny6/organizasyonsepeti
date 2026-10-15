// Yönetim paneli: ilan moderasyonu, ödemeler, promosyon kodları, üyeler, kara liste ve şikâyetler.
import { randomInt } from "node:crypto";
import { analyticsReport } from "../lib/analytics.mjs";
import { requireAdmin } from "../lib/auth.mjs";
import { deleteBlacklistRecord, listBlacklist, setBlocked } from "../lib/blacklist.mjs";
import { deleteUserBookings } from "../lib/bookings.mjs";
import { purgeSite } from "../lib/cache.mjs";
import { getContent, messageStore } from "../lib/content.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";
import {
  addDoping,
  clearDoping,
  deleteListing,
  deleteReport,
  deleteUserListings,
  extendListing,
  getListing,
  hideUserListings,
  listReports,
  moderateListing,
  parseListingParam,
  readIndex,
  updateReport,
} from "../lib/listings.mjs";
import { ORDER_ID, cancelOrder, confirmOrder, listOrders } from "../lib/orders.mjs";
import { DOPINGS } from "../lib/pricing.mjs";
import { deletePromo, listPromos, savePromo } from "../lib/promos.mjs";
import { deleteUserRequests } from "../lib/requests.mjs";
import { cityFromSlug } from "../lib/render/urls.mjs";
import { REVIEW_ID, allReviews, deleteReview, deleteUserReviews, moderateReview } from "../lib/reviews.mjs";
import { smsConfigured, smsTestMode } from "../lib/sms.mjs";
import { statsFor } from "../lib/stats.mjs";
import { USER_ID, deleteUserRecord, getUser, listUsers, publicUser, saveUser, setUserPassword } from "../lib/users.mjs";

const REPORT_ID = /^\d{13}-[a-f0-9]{10}$/;

// Karışması zor harfler/rakamlarla geçici şifre (0/O, 1/l yok).
function temporaryPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join("");
}

async function summary() {
  const [index, users, reports, messages, orders, blacklist, reviews, today] = await Promise.all([
    readIndex(),
    listUsers(),
    listReports(),
    messageStore().list(),
    listOrders(),
    listBlacklist(),
    allReviews(),
    analyticsReport(1),
  ]);
  const unread = await Promise.all(messages.blobs.slice(-200).map((b) => messageStore().get(b.key, { type: "json" })));
  const now = new Date().toISOString();
  return json({
    listings: {
      pending: index.filter((x) => x.status === "pending").length,
      active: index.filter((x) => x.status === "active" && x.expiresAt > now).length,
      expired: index.filter((x) => x.status === "active" && x.expiresAt && x.expiresAt <= now).length,
      total: index.length,
    },
    organizers: users.filter((u) => (u.role || "organizer") === "organizer").length,
    clients: users.filter((u) => u.role === "client").length,
    reports: reports.filter((r) => r.status === "open").length,
    unreadMessages: unread.filter((m) => m && !m.read).length,
    awaitingPayments: orders.filter((o) => o.status === "awaiting").length,
    revenue: orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.amount, 0),
    blocked: blacklist.filter((b) => b.blocked).length,
    pendingReviews: reviews.filter((r) => r.status === "pending").length,
    today: today.totals,
    sms: { configured: smsConfigured(), testMode: smsTestMode() },
  });
}

async function listingsRoute(req, id, action) {
  if (!id && req.method === "GET") {
    const index = await readIndex();
    const stats = await statsFor(index.map((x) => x.id));
    return json({ listings: index.map(({ text, ...rest }) => ({ ...rest, stats: stats[rest.id] })) });
  }
  const listing = await getListing(id);
  if (!listing) return fail(404, "İlan bulunamadı.");

  if (!action && req.method === "GET") {
    const owner = await getUser(listing.userId);
    return json({ listing, owner: owner && publicUser(owner) });
  }
  if (!action && req.method === "DELETE") {
    await deleteListing(listing);
    await purgeSite();
    return json({ ok: true });
  }
  if (action === "moderate" && req.method === "POST") {
    const { status, reason } = await readJson(req, 2048);
    await moderateListing(listing, status, reason);
    await purgeSite();
    return json({ listing });
  }
  // Ücretsiz süre ya da manuel paket tanımlama
  if (action === "extend" && req.method === "POST") {
    const days = Math.round(Number((await readJson(req, 512)).days));
    if (!(days >= 1 && days <= 730)) return fail(400, "Gün sayısı 1 ile 730 arasında olmalı.");
    await extendListing(listing, days);
    await purgeSite();
    return json({ listing });
  }
  if (action === "doping" && req.method === "POST") {
    const { doping, days } = await readJson(req, 512);
    if (!DOPINGS[doping]) return fail(400, "Geçersiz doping.");
    if (Number(days) === 0) await clearDoping(listing, doping);
    else {
      const d = Math.round(Number(days));
      if (!(d >= 1 && d <= 365)) return fail(400, "Gün sayısı 1 ile 365 arasında olmalı.");
      await addDoping(listing, doping, d);
    }
    await purgeSite();
    return json({ listing: await getListing(listing.id) });
  }
  return fail(404, "Bulunamadı.");
}

async function usersRoute(req, id, action) {
  if (!id && req.method === "GET") {
    const [users, index] = await Promise.all([listUsers(), readIndex()]);
    const counts = {};
    for (const x of index) {
      counts[x.userId] ??= { total: 0, active: 0, pending: 0 };
      counts[x.userId].total++;
      if (x.status === "active" || x.status === "pending") counts[x.userId][x.status]++;
    }
    return json({
      users: users.map((u) => ({ ...publicUser(u), listings: counts[u.id] || { total: 0, active: 0, pending: 0 } })),
    });
  }
  const user = await getUser(id);
  if (!user) return fail(404, "Üye bulunamadı.");

  if (action === "ban" && req.method === "POST") {
    const { banned } = await readJson(req, 1024);
    user.status = banned ? "banned" : "active";
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await saveUser(user);
    if (banned) await hideUserListings(user.id, "Hesap askıya alındı.");
    await purgeSite();
    return json({ user: publicUser(user) });
  }
  if (action === "reset-password" && req.method === "POST") {
    if (user.role === "client") return fail(400, "Ziyaretçi hesaplarının şifresi yoktur.");
    const password = temporaryPassword();
    await setUserPassword(user, password);
    return json({ password });
  }
  if (!action && req.method === "DELETE") {
    await deleteUserListings(user.id);
    await deleteUserBookings(user.id);
    await deleteUserRequests(user.id);
    await deleteUserReviews(user.id);
    await deleteUserRecord(user);
    await purgeSite();
    return json({ ok: true });
  }
  return fail(404, "Bulunamadı.");
}

async function ordersRoute(req, id, action) {
  if (!id && req.method === "GET") return json({ orders: await listOrders() });
  if (!ORDER_ID.test(String(id))) return fail(404, "Sipariş bulunamadı.");
  if (action === "confirm" && req.method === "POST") {
    const order = await confirmOrder(id);
    await purgeSite();
    return json({ order });
  }
  if (action === "cancel" && req.method === "POST") return json({ order: await cancelOrder(id) });
  return fail(404, "Bulunamadı.");
}

async function promosRoute(req, code) {
  if (!code && req.method === "GET") return json({ promos: await listPromos() });
  if (!code && req.method === "POST") return json({ promo: await savePromo(await readJson(req, 2048)) }, 201);
  if (code && req.method === "DELETE") {
    await deletePromo(code);
    return json({ ok: true });
  }
  return fail(404, "Bulunamadı.");
}

async function blacklistRoute(req, id) {
  if (!id && req.method === "GET") return json({ records: await listBlacklist() });
  if (!/^[a-f0-9]{64}$/.test(String(id))) return fail(404, "Kayıt bulunamadı.");
  if (req.method === "PATCH") {
    const { blocked } = await readJson(req, 512);
    return json({ record: await setBlocked(id, blocked) });
  }
  if (req.method === "DELETE") {
    await deleteBlacklistRecord(id);
    return json({ ok: true });
  }
  return fail(404, "Bulunamadı.");
}

async function reportsRoute(req, id) {
  if (!id && req.method === "GET") return json({ reports: await listReports() });
  if (!REPORT_ID.test(String(id))) return fail(404, "Şikâyet bulunamadı.");
  if (req.method === "PATCH") {
    const { status } = await readJson(req, 1024);
    return json({ report: await updateReport(id, status) });
  }
  if (req.method === "DELETE") {
    await deleteReport(id);
    return json({ ok: true });
  }
  return fail(404, "Bulunamadı.");
}

// İstatistiklerdeki sayfa adresine okunur bir ad verir.
const FIXED_PAGES = {
  "/": "Ana sayfa",
  "/ilanlar": "İlan arama",
  "/favoriler": "Favorilerim",
  "/iletisim": "İletişim",
  "/kvkk": "KVKK aydınlatma metni",
  "/kullanim-kosullari": "Kullanım koşulları",
};
function pageTitle(path, content, index) {
  if (FIXED_PAGES[path]) return FIXED_PAGES[path];
  const [kind, first, second] = path.split("/").filter(Boolean);
  if (kind === "ilan") {
    const id = parseListingParam(first);
    return index.find((x) => x.id === id)?.title || "İlan (yayından kalkmış)";
  }
  if (kind === "firma") {
    const id = /([a-f0-9]{12})$/.exec(first || "")?.[1];
    const company = index.find((x) => x.userId === id)?.company;
    return company ? `${company} (firma sayfası)` : "Firma sayfası";
  }
  if (kind === "hizmet") {
    const cat = content.categories.find((c) => c.slug === first)?.name || first;
    return [cityFromSlug(second), cat].filter(Boolean).join(" · ");
  }
  if (kind === "il") return `${cityFromSlug(first) || first} ilanları`;
  if (kind === "etkinlik") return content.events.find((e) => e.slug === first)?.name || first;
  return path;
}

// Değerlendirmeler: /api/admin/reviews[/<organizatör>/<değerlendirme>]
async function reviewsRoute(req, organizerId, id) {
  if (!organizerId && req.method === "GET") return json({ reviews: await allReviews() });
  if (!USER_ID.test(organizerId || "") || !REVIEW_ID.test(id || "")) return fail(404, "Değerlendirme bulunamadı.");
  if (req.method === "PATCH") {
    const { status } = await readJson(req, 512);
    const review = await moderateReview(organizerId, id, status);
    await purgeSite();
    return json({ review });
  }
  if (req.method === "DELETE") {
    await deleteReview(organizerId, id);
    await purgeSite();
    return json({ ok: true });
  }
  return fail(404, "Bulunamadı.");
}

export default async (req) => {
  try {
    await requireAdmin(req);
    const [resource, id, action] = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, "").split("/");
    if (resource === "summary" && req.method === "GET") return await summary();
    if (resource === "analytics" && req.method === "GET") {
      const requested = Number(new URL(req.url).searchParams.get("days"));
      const days = [1, 7, 30, 90].includes(requested) ? requested : 7;
      const [report, content, index] = await Promise.all([analyticsReport(days), getContent(), readIndex()]);
      report.pages = report.pages.map((p) => ({ ...p, title: pageTitle(p.key, content, index) }));
      return json(report);
    }
    if (resource === "listings") return await listingsRoute(req, id, action);
    if (resource === "users") return await usersRoute(req, id, action);
    if (resource === "orders") return await ordersRoute(req, id, action);
    if (resource === "promos") return await promosRoute(req, id ? decodeURIComponent(id) : "");
    if (resource === "blacklist") return await blacklistRoute(req, id);
    if (resource === "reports") return await reportsRoute(req, id);
    if (resource === "reviews") return await reviewsRoute(req, id, action);
    return fail(404, "Bulunamadı.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: "/api/admin/*" };
