// Firma değerlendirmeleri (1-5 yıldız ve yorum).
// Yalnızca o firmaya site üzerinden teklif talebi gönderen, telefonu doğrulanmış müşteriler yazabilir;
// yorumlar yönetici onayından sonra yayınlanır, firma yayındaki yoruma yanıt verebilir.
//   f/<organizatör>  firmanın tüm değerlendirmeleri
//   summary          yayındaki değerlendirmelerin firma bazında ortalaması { <organizatör>: { avg, count } }
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { HttpError } from "./http.mjs";
import { hasRequested } from "./requests.mjs";

const store = () => getStore({ name: "reviews", consistency: "strong" });
export const REVIEW_ID = /^\d{13}-[a-f0-9]{8}$/;
export const REVIEW_STATUSES = { pending: "Onay bekliyor", published: "Yayında", rejected: "Reddedildi" };
const MAX_PER_FIRM = 1000;

const clean = (value, max) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
const cleanText = (value, max) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

// "Mehmet Kaya" -> "Mehmet K." (tam ad yayınlanmaz)
export function displayName(name) {
  const [first, ...rest] = clean(name, 60).split(" ").filter(Boolean);
  const last = rest.at(-1);
  return [first, last && `${last.slice(0, 1).toLocaleUpperCase("tr")}.`].filter(Boolean).join(" ");
}

export function validateReview(input) {
  const review = {
    rating: Math.round(Number(input.rating)),
    comment: cleanText(input.comment, 1000),
    authorName: displayName(input.name),
  };
  if (!(review.rating >= 1 && review.rating <= 5)) throw new HttpError(400, "Lütfen 1 ile 5 arasında puan verin.");
  if (review.authorName.length < 2) throw new HttpError(400, "Lütfen adınızı yazın.");
  if (review.comment.length < 20)
    throw new HttpError(400, "Lütfen deneyiminizi biraz daha ayrıntılı anlatın (en az 20 karakter).");
  return review;
}

async function update(key, mutate) {
  const s = store();
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await s.getWithMetadata(key, { type: "json" });
    const next = mutate(current?.data ? structuredClone(current.data) : key === "summary" ? {} : []);
    const result = current
      ? await s.setJSON(key, next, { onlyIfMatch: current.etag })
      : await s.setJSON(key, next, { onlyIfNew: true });
    if (result.modified) return next;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  throw new HttpError(503, "Sistem şu an yoğun, lütfen birkaç saniye sonra tekrar deneyin.");
}

const firmKey = (organizerId) => `f/${organizerId}`;
export const listReviews = async (organizerId) => (await store().get(firmKey(organizerId), { type: "json" })) || [];
export const publishedReviews = async (organizerId) =>
  (await listReviews(organizerId)).filter((r) => r.status === "published");
export const ratingSummary = async () => (await store().get("summary", { type: "json" })) || {};

// Firmanın yayındaki yorumlarından ortalamayı yeniden hesaplar.
async function refreshSummary(organizerId, reviews) {
  const published = reviews.filter((r) => r.status === "published");
  const avg = published.length ? published.reduce((sum, r) => sum + r.rating, 0) / published.length : 0;
  await update("summary", (summary) => {
    if (published.length) summary[organizerId] = { avg: Math.round(avg * 10) / 10, count: published.length };
    else delete summary[organizerId];
    return summary;
  });
}

export async function createReview(organizer, author, input) {
  const data = validateReview(input);
  if (author.id === organizer.id) throw new HttpError(400, "Kendi firmanızı değerlendiremezsiniz.");
  if (!(await hasRequested(author.id, organizer.id))) {
    throw new HttpError(
      403,
      "Değerlendirme yalnızca bu firmaya sitemiz üzerinden teklif talebi gönderen müşteriler tarafından yazılabilir.",
    );
  }
  const now = new Date().toISOString();
  const review = {
    id: `${Date.now()}-${randomBytes(4).toString("hex")}`,
    organizerId: organizer.id,
    company: organizer.company,
    authorId: author.id,
    ...data,
    status: "pending",
    reply: "",
    replyAt: "",
    createdAt: now,
    updatedAt: now,
  };
  await update(firmKey(organizer.id), (list) => {
    if (list.some((r) => r.authorId === author.id && r.status !== "rejected")) {
      throw new HttpError(409, "Bu firmayı daha önce değerlendirdiniz.");
    }
    return [review, ...list].slice(0, MAX_PER_FIRM);
  });
  return review;
}

async function change(organizerId, id, apply) {
  let changed = null;
  const list = await update(firmKey(organizerId), (reviews) =>
    reviews.map((r) => (r.id === id ? (changed = { ...apply(r), updatedAt: new Date().toISOString() }) : r)),
  );
  if (!changed) throw new HttpError(404, "Değerlendirme bulunamadı.");
  return { review: changed, list };
}

export async function moderateReview(organizerId, id, status) {
  if (!REVIEW_STATUSES[status]) throw new HttpError(400, "Geçersiz durum.");
  const { review, list } = await change(organizerId, id, (r) => ({ ...r, status }));
  await refreshSummary(organizerId, list);
  return review;
}

// Firma yalnızca yayındaki yoruma yanıt verebilir; boş yanıt mevcut yanıtı kaldırır.
export async function replyReview(organizerId, id, text) {
  const reply = cleanText(text, 600);
  const { review } = await change(organizerId, id, (r) => {
    if (r.status !== "published") throw new HttpError(400, "Yalnızca yayındaki değerlendirmelere yanıt verilebilir.");
    return { ...r, reply, replyAt: reply ? new Date().toISOString() : "" };
  });
  return review;
}

export async function deleteReview(organizerId, id) {
  const list = await update(firmKey(organizerId), (reviews) => reviews.filter((r) => r.id !== id));
  await refreshSummary(organizerId, list);
}

// Yönetim paneli: tüm firmaların değerlendirmeleri (en yeni önce)
export async function allReviews() {
  const { blobs } = await store().list({ prefix: "f/" });
  const lists = await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" })));
  return lists
    .flat()
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Hesap silinince: firmanın değerlendirmeleri ve üyenin yazdığı değerlendirmeler silinir.
export async function deleteUserReviews(userId) {
  await store().delete(firmKey(userId));
  await update("summary", (summary) => {
    delete summary[userId];
    return summary;
  });
  const { blobs } = await store().list({ prefix: "f/" });
  for (const { key } of blobs) {
    const list = (await store().get(key, { type: "json" })) || [];
    if (!list.some((r) => r.authorId === userId)) continue;
    const next = await update(key, (reviews) => reviews.filter((r) => r.authorId !== userId));
    await refreshSummary(key.slice(2), next);
  }
}
