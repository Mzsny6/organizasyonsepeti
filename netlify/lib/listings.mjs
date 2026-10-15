// İlanlar: kayıtlar, durum akışı (onay bekliyor → yayında / reddedildi / pasif), arama dizini ve şikâyetler.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { isValidLocation } from "../../public/assets/js/locations.js";
import { mediaStore } from "./content.mjs";
import { HttpError } from "./http.mjs";
import { foldText, slugify } from "./text.mjs";
import { formatPhone } from "./users.mjs";

export const listingStore = () => getStore({ name: "listings", consistency: "strong" });
const reportStore = () => getStore({ name: "reports", consistency: "strong" });

export const LISTING_ID = /^[a-f0-9]{10}$/;
export const STATUSES = {
  pending: "Onay bekliyor",
  active: "Yayında",
  rejected: "Reddedildi",
  passive: "Yayında değil",
};
export const MAX_IMAGES = 12;
export const MAX_OPEN_PER_USER = 30;
const MEDIA_URL = /^\/media\/([a-z0-9]+-[a-f0-9]{10}\.(?:jpg|png|webp|gif|avif))$/;

export const listingPath = (l) => `/ilan/${l.slug}-${l.id}`;
export const parseListingParam = (param) => /([a-f0-9]{10})$/.exec(String(param || ""))?.[1] || null;

export const formatPrice = (n) => (n ? `${Number(n).toLocaleString("tr-TR")} ₺` : "");

const clean = (value, max) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
const cleanText = (value, max) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

export function validateListingInput(input, categories) {
  const listing = {
    title: clean(input.title, 90),
    category: clean(input.category, 40),
    city: clean(input.city, 40),
    district: clean(input.district, 40),
    description: cleanText(input.description, 5000),
    priceMin: null,
    priceNote: clean(input.priceNote, 40),
    phone: formatPhone(clean(input.phone, 30)),
    whatsapp: Boolean(input.whatsapp),
    instagram: clean(input.instagram, 80)
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/[/?#].*$/, ""),
    images: Array.isArray(input.images) ? input.images.map(String).slice(0, MAX_IMAGES) : [],
  };
  const price = String(input.priceMin ?? "").replace(/[^\d]/g, "");
  if (price) listing.priceMin = Math.min(Number(price), 99_999_999);

  if (listing.title.length < 10) throw new HttpError(400, "İlan başlığı en az 10 karakter olmalı.");
  if (!categories.some((c) => c.id === listing.category)) throw new HttpError(400, "Lütfen bir kategori seçin.");
  if (!isValidLocation(listing.city, listing.district)) throw new HttpError(400, "Lütfen il ve ilçeyi listeden seçin.");
  if (listing.description.length < 30) throw new HttpError(400, "Açıklama en az 30 karakter olmalı.");
  if (listing.phone.replace(/\D/g, "").length < 10)
    throw new HttpError(400, "Lütfen geçerli bir telefon numarası yazın.");
  if (listing.instagram && !/^@?[\w.]{1,40}$/.test(listing.instagram)) {
    throw new HttpError(400, "Instagram kullanıcı adı geçersiz görünüyor.");
  }
  listing.instagram = listing.instagram.replace(/^@/, "");
  return listing;
}

// Görsellerin gerçekten bu üye tarafından yüklendiğini doğrular.
async function assertOwnImages(images, ownerId) {
  const keys = images.map((url) => MEDIA_URL.exec(url)?.[1]);
  if (keys.some((k) => !k)) throw new HttpError(400, "Geçersiz görsel.");
  const metas = await Promise.all(keys.map((key) => mediaStore().getMetadata(key)));
  if (metas.some((m) => m?.metadata?.owner !== ownerId)) throw new HttpError(400, "Geçersiz görsel.");
}

const mediaKeysOf = (images) => images.map((url) => MEDIA_URL.exec(url)?.[1]).filter(Boolean);
const deleteImages = (images) => Promise.all(mediaKeysOf(images).map((key) => mediaStore().delete(key)));

/* ---------- Arama dizini ----------
   Tüm ilanların özeti tek bir "index" kaydında tutulur; arama ve listeleme buradan yapılır.
   Aynı anda iki yazma olursa ETag kontrolüyle yeniden denenir. */

export function summarize(l) {
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    category: l.category,
    city: l.city,
    district: l.district,
    priceMin: l.priceMin,
    priceNote: l.priceNote,
    image: l.images[0] || "",
    imageCount: l.images.length,
    company: l.company,
    userId: l.userId,
    status: l.status,
    featured: Boolean(l.featured),
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    publishedAt: l.publishedAt || "",
    rejectReason: l.rejectReason || "",
    excerpt: l.description.slice(0, 200),
    text: foldText(`${l.title} ${l.company} ${l.district} ${l.description.slice(0, 600)}`),
  };
}

export async function readIndex() {
  return (await listingStore().get("index", { type: "json" })) || [];
}

async function updateIndex(mutate) {
  const store = listingStore();
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store.getWithMetadata("index", { type: "json" });
    const next = mutate(current?.data ? [...current.data] : []);
    const result = current
      ? await store.setJSON("index", next, { onlyIfMatch: current.etag })
      : await store.setJSON("index", next, { onlyIfNew: true });
    if (result.modified) return next;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  throw new HttpError(503, "Sistem şu an yoğun, lütfen birkaç saniye sonra tekrar deneyin.");
}

const upsertIndex = (listing) =>
  updateIndex((list) => [summarize(listing), ...list.filter((x) => x.id !== listing.id)]);
const removeFromIndex = (id) => updateIndex((list) => list.filter((x) => x.id !== id));

/* ---------- Kayıt işlemleri ---------- */

export async function getListing(id) {
  if (!LISTING_ID.test(String(id))) return null;
  return listingStore().get(`l/${id}`, { type: "json" });
}

async function saveListing(listing) {
  await listingStore().setJSON(`l/${listing.id}`, listing);
  await upsertIndex(listing);
  return listing;
}

export async function createListing(user, input, categories) {
  const data = validateListingInput(input, categories);
  await assertOwnImages(data.images, user.id);
  const open = (await readIndex()).filter((x) => x.userId === user.id && x.status !== "rejected").length;
  if (open >= MAX_OPEN_PER_USER) {
    throw new HttpError(
      429,
      `En fazla ${MAX_OPEN_PER_USER} ilanınız olabilir. Yeni ilan için eski ilanlarınızdan birini silin.`,
    );
  }
  const now = new Date().toISOString();
  return saveListing({
    id: randomBytes(5).toString("hex"),
    userId: user.id,
    company: user.company,
    ...data,
    slug: slugify(data.title),
    status: "pending",
    approved: false,
    featured: false,
    rejectReason: "",
    createdAt: now,
    updatedAt: now,
    publishedAt: "",
  });
}

// İçerik değişen ilan yeniden onaya düşer.
export async function updateListing(user, listing, input, categories) {
  const data = validateListingInput(input, categories);
  await assertOwnImages(data.images, user.id);
  const removed = listing.images.filter((url) => !data.images.includes(url));
  Object.assign(listing, data, {
    company: user.company,
    slug: slugify(data.title),
    status: listing.status === "passive" ? "passive" : "pending",
    approved: false,
    rejectReason: "",
    updatedAt: new Date().toISOString(),
  });
  await saveListing(listing);
  await deleteImages(removed);
  return listing;
}

export async function setOwnerActive(listing, active) {
  if (listing.status === "rejected")
    throw new HttpError(400, "Reddedilen ilanı yeniden yayınlamak için düzenleyip tekrar gönderin.");
  listing.status = active ? (listing.approved ? "active" : "pending") : "passive";
  listing.updatedAt = new Date().toISOString();
  return saveListing(listing);
}

export async function moderateListing(listing, status, reason = "") {
  if (!STATUSES[status]) throw new HttpError(400, "Geçersiz durum.");
  listing.status = status;
  if (status === "active") {
    listing.approved = true;
    listing.rejectReason = "";
    listing.publishedAt ||= new Date().toISOString();
  }
  if (status === "rejected") {
    listing.approved = false;
    listing.featured = false;
    listing.rejectReason = clean(reason, 300) || "İlan yayın kurallarına uygun bulunmadı.";
  }
  return saveListing(listing);
}

export async function setFeatured(listing, featured) {
  listing.featured = Boolean(featured);
  return saveListing(listing);
}

export async function deleteListing(listing) {
  await listingStore().delete(`l/${listing.id}`);
  await removeFromIndex(listing.id);
  await deleteImages(listing.images);
}

// Üye firma adını değiştirince ilanlarındaki ad da güncellenir.
export async function renameCompany(user) {
  const mine = (await readIndex()).filter((x) => x.userId === user.id);
  for (const summary of mine) {
    const listing = await getListing(summary.id);
    if (!listing || listing.company === user.company) continue;
    listing.company = user.company;
    await saveListing(listing);
  }
}

export async function deleteUserListings(userId) {
  for (const summary of (await readIndex()).filter((x) => x.userId === userId)) {
    const listing = await getListing(summary.id);
    if (listing) await deleteListing(listing);
  }
}

export async function hideUserListings(userId, reason) {
  for (const summary of (await readIndex()).filter((x) => x.userId === userId && x.status !== "rejected")) {
    const listing = await getListing(summary.id);
    if (listing) await moderateListing(listing, "rejected", reason);
  }
}

/* ---------- Arama ---------- */

export const SORTS = {
  onerilen: "Önerilen",
  yeni: "En yeni",
  "fiyat-artan": "Fiyat (artan)",
  "fiyat-azalan": "Fiyat (azalan)",
};
export const PER_PAGE = 24;

export function searchIndex(index, { category, city, district, q, sort, page }) {
  const terms = foldText(q)
    .split(/\s+/)
    .filter((t) => t.length > 1);
  let items = index.filter(
    (x) =>
      x.status === "active" &&
      (!category || x.category === category) &&
      (!city || x.city === city) &&
      (!district || x.district === district || !x.district) &&
      terms.every((t) => x.text.includes(t)),
  );
  const byDate = (a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt);
  const price = (x, dir) => (x.priceMin ? x.priceMin * dir : Number.MAX_SAFE_INTEGER);
  const sorters = {
    onerilen: (a, b) => Number(b.featured) - Number(a.featured) || byDate(a, b),
    yeni: byDate,
    "fiyat-artan": (a, b) => price(a, 1) - price(b, 1) || byDate(a, b),
    "fiyat-azalan": (a, b) => price(a, -1) - price(b, -1) || byDate(a, b),
  };
  items = items.sort(sorters[sort] || sorters.onerilen);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  return {
    items: items.slice((current - 1) * PER_PAGE, current * PER_PAGE),
    total: items.length,
    page: current,
    pages,
  };
}

export function countBy(index, field) {
  const counts = {};
  for (const x of index) if (x.status === "active") counts[x[field]] = (counts[x[field]] || 0) + 1;
  return counts;
}

/* ---------- Şikâyetler ---------- */

export const REPORT_REASONS = {
  yaniltici: "Yanıltıcı ya da yanlış bilgi",
  dolandiricilik: "Dolandırıcılık şüphesi",
  uygunsuz: "Uygunsuz içerik",
  kopya: "Başkasına ait fotoğraf veya kopya ilan",
  diger: "Diğer",
};

export async function createReport(listing, input) {
  const reason = REPORT_REASONS[input.reason] ? input.reason : "diger";
  const id = `${Date.now()}-${randomBytes(5).toString("hex")}`;
  const report = {
    id,
    listingId: listing.id,
    listingTitle: listing.title,
    reason,
    message: cleanText(input.message, 1000),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  await reportStore().setJSON(id, report);
  return report;
}

export async function listReports() {
  const store = reportStore();
  const { blobs } = await store.list();
  const keys = blobs
    .map((b) => b.key)
    .sort()
    .reverse()
    .slice(0, 500);
  return (await Promise.all(keys.map((k) => store.get(k, { type: "json" })))).filter(Boolean);
}

export async function updateReport(id, status) {
  const store = reportStore();
  const report = await store.get(String(id), { type: "json" });
  if (!report) throw new HttpError(404, "Şikâyet bulunamadı.");
  report.status = status === "closed" ? "closed" : "open";
  await store.setJSON(report.id, report);
  return report;
}

export const deleteReport = (id) => reportStore().delete(String(id));
