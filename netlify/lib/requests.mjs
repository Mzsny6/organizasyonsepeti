// Teklif talepleri: ziyaretçinin ilan sahibine tarih, kişi sayısı ve notla gönderdiği istek.
// Her organizatörün talepleri tek kayıtta (o/<organizatör>) tutulur; gönderenin listesinde
// yalnızca talebe giden işaretçi (c/<gönderen>) bulunur.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { HttpError } from "./http.mjs";
import { listingPath } from "./listings.mjs";
import { formatPhone } from "./users.mjs";

const store = () => getStore({ name: "requests", consistency: "strong" });
export const REQUEST_ID = /^\d{13}-[a-f0-9]{8}$/;
export const REQUEST_STATUSES = { new: "Yeni", contacted: "Görüşüldü", won: "Anlaşıldı", lost: "Olmadı" };
const MAX_PER_ORGANIZER = 500;
const MAX_PER_SENDER = 100;
const KEEP_DAYS = 365;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

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
const today = () => new Date().toISOString().slice(0, 10);

export function validateRequest(input, content) {
  const request = {
    name: clean(input.name, 60),
    eventDate: clean(input.eventDate, 10),
    guests: Math.min(100_000, Math.max(0, Number.parseInt(String(input.guests ?? "").replace(/\D/g, ""), 10) || 0)),
    event: content.events.some((e) => e.id === input.event) ? input.event : "",
    message: cleanText(input.message, 1000),
  };
  if (request.name.length < 2) throw new HttpError(400, "Lütfen adınızı yazın.");
  if (request.eventDate) {
    const max = new Date(Date.now() + 3 * 365 * 864e5).toISOString().slice(0, 10);
    if (!DATE.test(request.eventDate) || Number.isNaN(Date.parse(request.eventDate)))
      throw new HttpError(400, "Etkinlik tarihi geçersiz.");
    if (request.eventDate < today() || request.eventDate > max)
      throw new HttpError(400, "Lütfen bugünden sonraki bir tarih seçin.");
  }
  if (request.message.length < 10)
    throw new HttpError(400, "Lütfen organizatöre iletmek istediğiniz ayrıntıları yazın (en az 10 karakter).");
  return request;
}

// Aynı kayda iki yazma çakışırsa ETag kontrolüyle yeniden denenir.
async function update(key, mutate) {
  const s = store();
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await s.getWithMetadata(key, { type: "json" });
    const next = mutate(current?.data ? [...current.data] : []);
    const result = current
      ? await s.setJSON(key, next, { onlyIfMatch: current.etag })
      : await s.setJSON(key, next, { onlyIfNew: true });
    if (result.modified) return next;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  throw new HttpError(503, "Sistem şu an yoğun, lütfen birkaç saniye sonra tekrar deneyin.");
}

const read = async (key) => (await store().get(key, { type: "json" })) || [];

// sender: gönderen üye (varsa), mobile: 905XXXXXXXXX, phoneVerified: SMS ile doğrulandı mı
export async function createRequest(listing, { sender, mobile, phoneVerified }, input, content) {
  const data = validateRequest(input, content);
  const now = new Date().toISOString();
  const request = {
    id: `${Date.now()}-${randomBytes(4).toString("hex")}`,
    listingId: listing.id,
    listingTitle: listing.title,
    listingPath: listingPath(listing),
    senderId: sender?.id || "",
    ...data,
    phone: formatPhone(mobile),
    mobile,
    phoneVerified: Boolean(phoneVerified),
    status: "new",
    note: "",
    createdAt: now,
    updatedAt: now,
  };
  await update(`o/${listing.userId}`, (list) => [request, ...list].slice(0, MAX_PER_ORGANIZER));
  if (request.senderId) {
    await update(`c/${request.senderId}`, (list) =>
      [{ organizerId: listing.userId, id: request.id }, ...list].slice(0, MAX_PER_SENDER),
    );
  }
  return request;
}

export const listRequests = (organizerId) => read(`o/${organizerId}`);

export async function countNewRequests(organizerId) {
  return (await listRequests(organizerId)).filter((r) => r.status === "new").length;
}

export async function updateRequest(organizerId, id, input) {
  let updated = null;
  await update(`o/${organizerId}`, (list) =>
    list.map((r) => {
      if (r.id !== id) return r;
      updated = {
        ...r,
        status: REQUEST_STATUSES[input.status] ? input.status : r.status,
        note: input.note === undefined ? r.note : cleanText(input.note, 1000),
        updatedAt: new Date().toISOString(),
      };
      return updated;
    }),
  );
  if (!updated) throw new HttpError(404, "Talep bulunamadı.");
  return updated;
}

export async function deleteRequest(organizerId, id) {
  await update(`o/${organizerId}`, (list) => list.filter((r) => r.id !== id));
}

// Gönderenin kendi talepleri: organizatörün özel notu ve ayrıntılı durumu gösterilmez.
export async function listSentRequests(senderId) {
  const pointers = await read(`c/${senderId}`);
  const byOrganizer = new Map();
  for (const p of pointers) {
    if (!byOrganizer.has(p.organizerId)) byOrganizer.set(p.organizerId, listRequests(p.organizerId));
  }
  const lists = new Map(await Promise.all([...byOrganizer].map(async ([id, list]) => [id, await list])));
  return pointers
    .map((p) => lists.get(p.organizerId)?.find((r) => r.id === p.id))
    .filter(Boolean)
    .map((r) => ({
      id: r.id,
      listingTitle: r.listingTitle,
      listingPath: r.listingPath,
      eventDate: r.eventDate,
      guests: r.guests,
      message: r.message,
      seen: r.status !== "new",
      createdAt: r.createdAt,
    }));
}

// Hesap silinince: organizatörün gelen talepleri ve gönderenin talepleri (organizatör tarafındaki kopyası dahil) silinir.
export async function deleteUserRequests(userId) {
  const s = store();
  const pointers = await read(`c/${userId}`);
  for (const organizerId of new Set(pointers.map((p) => p.organizerId))) {
    await update(`o/${organizerId}`, (list) => list.filter((r) => r.senderId !== userId));
  }
  await Promise.all([s.delete(`o/${userId}`), s.delete(`c/${userId}`)]);
}

// Günlük temizlik: bir yıldan eski talepler silinir (KVKK: gereğinden uzun saklanmaz).
export async function purgeOldRequests() {
  const s = store();
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  const { blobs } = await s.list({ prefix: "o/" });
  for (const { key } of blobs) {
    const list = await read(key);
    if (list.some((r) => r.createdAt < cutoff)) await update(key, (l) => l.filter((r) => r.createdAt >= cutoff));
  }
}
