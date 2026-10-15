// Organizatör randevu takvimi (CRM): platformdan ya da dışarıdan alınan işler.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { phoneRecord } from "./blacklist.mjs";
import { HttpError } from "./http.mjs";
import { formatPhone } from "./users.mjs";

const store = () => getStore({ name: "bookings", consistency: "strong" });
export const BOOKING_ID = /^\d{13}-[a-f0-9]{8}$/;
export const BOOKING_STATUSES = {
  option: "Opsiyon",
  confirmed: "Kesinleşti",
  done: "Tamamlandı",
  cancelled: "İptal",
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const clean = (value, max) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
const money = (value) => Math.min(99_999_999, Math.max(0, Number(String(value ?? "").replace(/[^\d]/g, "")) || 0));

export async function listBookings(userId) {
  const { blobs } = await store().list({ prefix: `u/${userId}/` });
  const bookings = await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" })));
  return bookings
    .filter(Boolean)
    .sort((a, b) => `${a.eventDate}${a.eventTime}`.localeCompare(`${b.eventDate}${b.eventTime}`));
}

function validate(input, listingIds) {
  const booking = {
    clientName: clean(input.clientName, 80),
    clientPhone: formatPhone(clean(input.clientPhone, 30)),
    eventDate: clean(input.eventDate, 10),
    eventTime: /^\d{2}:\d{2}$/.test(String(input.eventTime || "")) ? input.eventTime : "",
    location: clean(input.location, 160),
    listingId: listingIds.includes(input.listingId) ? input.listingId : "",
    totalAmount: money(input.totalAmount),
    deposit: money(input.deposit),
    status: BOOKING_STATUSES[input.status] ? input.status : "option",
    note: String(input.note ?? "")
      .trim()
      .slice(0, 1000),
  };
  if (booking.clientName.length < 2) throw new HttpError(400, "Lütfen müşteri adını yazın.");
  if (!DATE.test(booking.eventDate) || Number.isNaN(Date.parse(booking.eventDate)))
    throw new HttpError(400, "Lütfen etkinlik tarihini seçin.");
  if (booking.deposit > booking.totalAmount && booking.totalAmount)
    throw new HttpError(400, "Kapora toplam tutardan büyük olamaz.");
  return booking;
}

// Aynı gün başka (iptal edilmemiş) kayıt varsa ve force verilmemişse kaydetmez, çakışmaları döner.
export async function saveBooking(user, input, { id, listingIds, force }) {
  const data = validate(input, listingIds);
  const existing = id ? await store().get(`u/${user.id}/${id}`, { type: "json" }) : null;
  if (id && !existing) throw new HttpError(404, "Kayıt bulunamadı.");

  const all = await listBookings(user.id);
  const conflicts =
    data.status === "cancelled"
      ? []
      : all.filter((b) => b.id !== id && b.eventDate === data.eventDate && b.status !== "cancelled");
  if (conflicts.length && !force) return { conflicts };

  const now = new Date().toISOString();
  const booking = existing
    ? { ...existing, ...data, updatedAt: now }
    : {
        id: `${Date.now()}-${randomBytes(4).toString("hex")}`,
        userId: user.id,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
  await store().setJSON(`u/${user.id}/${booking.id}`, booking);

  // Müşteri numarası hakkında kara liste ihbarı varsa organizatör uyarılır.
  const record = booking.clientPhone ? await phoneRecord(booking.clientPhone) : null;
  return {
    booking,
    warning: record?.reports.length ? { reports: record.reports.length, blocked: record.blocked } : null,
  };
}

export async function deleteBooking(user, id) {
  if (!BOOKING_ID.test(String(id))) throw new HttpError(404, "Kayıt bulunamadı.");
  await store().delete(`u/${user.id}/${id}`);
}

export async function deleteUserBookings(userId) {
  const { blobs } = await store().list({ prefix: `u/${userId}/` });
  await Promise.all(blobs.map((b) => store().delete(b.key)));
}

// İlanda gösterilen dolu günler: müşteri bilgisi içermez, yalnızca tarih.
export async function busyDays(userId, months = 6) {
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + months * 31 * 864e5).toISOString().slice(0, 10);
  const days = new Set();
  for (const b of await listBookings(userId)) {
    if ((b.status === "confirmed" || b.status === "option") && b.eventDate >= today && b.eventDate <= until)
      days.add(b.eventDate);
  }
  return [...days].sort();
}
