// Organizatör ajandası (CRM): platformdan ya da dışarıdan alınan işler ve kapalı günler.
//   kind "job"   müşteri işi (saat aralığı, mekân, tutar, alınan ödeme)
//   kind "block" kapalı gün / saat (tatil, izin); ilanda dolu görünür
// Günlük kapasite (aynı gün en fazla kaç iş) üye kaydında tutulur; saat aralıkları çakışan işler
// kapasiteden bağımsız olarak çakışma sayılır.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { phoneRecord } from "./blacklist.mjs";
import { sha256 } from "./crypto.mjs";
import { HttpError } from "./http.mjs";
import { formatPhone, getUser, saveUser, userStore } from "./users.mjs";

const store = () => getStore({ name: "bookings", consistency: "strong" });
export const BOOKING_ID = /^\d{13}-[a-f0-9]{8}$/;
export const BOOKING_STATUSES = {
  option: "Opsiyon",
  confirmed: "Kesinleşti",
  done: "Tamamlandı",
  cancelled: "İptal",
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_CAPACITY = 10;

const clean = (value, max) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
const money = (value) => Math.min(99_999_999, Math.max(0, Number(String(value ?? "").replace(/[^\d]/g, "")) || 0));

export const capacityOf = (user) => Math.min(MAX_CAPACITY, Math.max(1, Math.round(Number(user?.dailyCapacity) || 1)));

export async function listBookings(userId) {
  const { blobs } = await store().list({ prefix: `u/${userId}/` });
  const bookings = await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" })));
  return bookings
    .filter(Boolean)
    .map((b) => ({ kind: "job", endTime: "", ...b }))
    .sort((a, b) => `${a.eventDate}${a.eventTime}`.localeCompare(`${b.eventDate}${b.eventTime}`));
}

function validate(input, listingIds) {
  const kind = input.kind === "block" ? "block" : "job";
  const booking = {
    kind,
    clientName: clean(input.clientName, 80),
    clientPhone: kind === "job" ? formatPhone(clean(input.clientPhone, 30)) : "",
    eventDate: clean(input.eventDate, 10),
    eventTime: TIME.test(String(input.eventTime || "")) ? input.eventTime : "",
    endTime: TIME.test(String(input.endTime || "")) ? input.endTime : "",
    location: kind === "job" ? clean(input.location, 160) : "",
    listingId: kind === "job" && listingIds.includes(input.listingId) ? input.listingId : "",
    totalAmount: kind === "job" ? money(input.totalAmount) : 0,
    deposit: kind === "job" ? money(input.deposit) : 0,
    status: kind === "block" ? "confirmed" : BOOKING_STATUSES[input.status] ? input.status : "option",
    note: String(input.note ?? "")
      .trim()
      .slice(0, 1000),
  };
  if (kind === "block" && !booking.clientName) booking.clientName = "Kapalı";
  if (booking.clientName.length < 2) throw new HttpError(400, "Lütfen müşteri adını yazın.");
  if (!DATE.test(booking.eventDate) || Number.isNaN(Date.parse(booking.eventDate)))
    throw new HttpError(400, "Lütfen tarihi seçin.");
  if (booking.endTime && !booking.eventTime) throw new HttpError(400, "Bitiş saati için başlangıç saatini de yazın.");
  if (booking.endTime && booking.endTime <= booking.eventTime)
    throw new HttpError(400, "Bitiş saati başlangıç saatinden sonra olmalı.");
  if (booking.deposit > booking.totalAmount && booking.totalAmount)
    throw new HttpError(400, "Alınan ödeme toplam tutardan büyük olamaz.");
  return booking;
}

const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
// Saat aralığı yoksa gün boyu sayılır.
const range = (b) =>
  b.eventTime ? [minutes(b.eventTime), b.endTime ? minutes(b.endTime) : minutes(b.eventTime) + 1] : [0, 1440];
const overlaps = (a, b) => {
  const [a1, a2] = range(a);
  const [b1, b2] = range(b);
  return a1 < b2 && b1 < a2;
};

// Aynı gün çakışan kayıtlar: kapalı saat/gün ile çakışma, saat aralığı çakışması ya da günlük kapasitenin dolması.
export function findConflicts(all, data, capacity, id) {
  if (data.status === "cancelled") return [];
  const sameDay = all.filter((b) => b.id !== id && b.eventDate === data.eventDate && b.status !== "cancelled");
  const blocks = sameDay.filter((b) => b.kind === "block");
  const jobs = sameDay.filter((b) => b.kind !== "block");
  if (data.kind === "block") return sameDay.filter((b) => overlaps(b, data));
  const timed = data.eventTime && data.endTime;
  const clashing = [
    ...blocks.filter((b) => overlaps(b, data)),
    ...jobs.filter((b) => timed && b.eventTime && b.endTime && overlaps(b, data)),
  ];
  if (clashing.length) return clashing;
  return jobs.length >= capacity ? jobs : [];
}

// Çakışma varsa ve force verilmemişse kaydetmez, çakışmaları döner.
export async function saveBooking(user, input, { id, listingIds, force }) {
  const data = validate(input, listingIds);
  const existing = id ? await store().get(`u/${user.id}/${id}`, { type: "json" }) : null;
  if (id && !existing) throw new HttpError(404, "Kayıt bulunamadı.");

  const conflicts = findConflicts(await listBookings(user.id), data, capacityOf(user), id);
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
// Gün; tüm gün kapalıysa ya da aktif iş sayısı günlük kapasiteye ulaştıysa dolu sayılır.
export async function busyDays(userId, months = 6) {
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + months * 31 * 864e5).toISOString().slice(0, 10);
  const [user, bookings] = await Promise.all([getUser(userId), listBookings(userId)]);
  const capacity = capacityOf(user);
  const jobs = {};
  const days = new Set();
  for (const b of bookings) {
    if (b.eventDate < today || b.eventDate > until) continue;
    if (b.kind === "block" && !b.eventTime) days.add(b.eventDate);
    if (b.kind !== "block" && (b.status === "confirmed" || b.status === "option")) {
      jobs[b.eventDate] = (jobs[b.eventDate] || 0) + 1;
      if (jobs[b.eventDate] >= capacity) days.add(b.eventDate);
    }
  }
  return [...days].sort();
}

/* ---------- Ajanda ayarları ve telefon takvimi aboneliği (ICS) ---------- */

const icsKey = (token) => `ics/${sha256(token)}`;

export function agendaSettings(user, siteUrl) {
  return {
    dailyCapacity: capacityOf(user),
    icsUrl: user.icsToken ? `${siteUrl.replace(/\/$/, "")}/takvim/${user.icsToken}.ics` : "",
  };
}

export async function updateAgendaSettings(user, input) {
  if (input.dailyCapacity !== undefined) {
    const n = Math.round(Number(input.dailyCapacity));
    if (!(n >= 1 && n <= MAX_CAPACITY))
      throw new HttpError(400, `Günlük kapasite 1 ile ${MAX_CAPACITY} arasında olmalı.`);
    user.dailyCapacity = n;
  }
  await saveUser(user);
  return user;
}

// Yeni gizli takvim bağlantısı üretir; eskisi çalışmaz olur.
export async function resetIcsToken(user) {
  const s = userStore();
  if (user.icsToken) await s.delete(icsKey(user.icsToken));
  user.icsToken = randomBytes(18).toString("hex");
  await s.set(icsKey(user.icsToken), user.id);
  await saveUser(user);
  return user;
}

export async function disableIcs(user) {
  if (user.icsToken) await userStore().delete(icsKey(user.icsToken));
  user.icsToken = "";
  await saveUser(user);
  return user;
}

export async function userByIcsToken(token) {
  if (!/^[a-f0-9]{36}$/.test(String(token || ""))) return null;
  const id = await userStore().get(icsKey(token));
  const user = id ? await getUser(id) : null;
  return user && user.icsToken === token && user.status !== "banned" ? user : null;
}

const icsText = (s) =>
  String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/[;,]/g, (c) => `\\${c}`)
    .replace(/\r?\n/g, "\\n");
// RFC 5545: satırlar 75 baytı geçmez, devam satırı bir boşlukla başlar.
function fold(line) {
  const out = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > 74) {
      out.push(current);
      current = ` ${ch}`;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n");
}
const stamp = (iso) => iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
// Türkiye saati (UTC+3) → UTC
const utc = (date, time) => stamp(new Date(Date.parse(`${date}T${time}:00+03:00`)).toISOString());
const nextDay = (date) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 864e5).toISOString().slice(0, 10).replace(/-/g, "");

export function bookingsToIcs(user, bookings, { listings = [], siteName = "Organizasyon Sepeti" } = {}) {
  const titleOf = (id) => listings.find((l) => l.id === id)?.title || "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Organizasyon Sepeti//Ajanda//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(`${siteName} · ${user.company}`)}`,
    "X-WR-TIMEZONE:Europe/Istanbul",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const remaining = Math.max(0, b.totalAmount - b.deposit);
    const summary =
      b.kind === "block"
        ? `Kapalı${b.note ? ` · ${b.note.split("\n")[0].slice(0, 60)}` : ""}`
        : `${b.status === "option" ? "(Opsiyon) " : ""}${b.clientName}${titleOf(b.listingId) ? ` · ${titleOf(b.listingId)}` : ""}`;
    const description = [
      b.clientPhone && `Telefon: ${b.clientPhone}`,
      b.totalAmount && `Toplam: ${b.totalAmount.toLocaleString("tr-TR")} TL`,
      b.deposit && `Alınan: ${b.deposit.toLocaleString("tr-TR")} TL`,
      b.totalAmount && `Kalan: ${remaining.toLocaleString("tr-TR")} TL`,
      `Durum: ${BOOKING_STATUSES[b.status] || b.status}`,
      b.kind !== "block" && b.note,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push("BEGIN:VEVENT", `UID:${b.id}@organizasyonsepeti.net`, `DTSTAMP:${stamp(b.updatedAt || b.createdAt)}`);
    if (b.eventTime) {
      const end =
        b.endTime ||
        `${String(Math.min(23, Number(b.eventTime.slice(0, 2)) + 1)).padStart(2, "0")}${b.eventTime.slice(2)}`;
      lines.push(`DTSTART:${utc(b.eventDate, b.eventTime)}`, `DTEND:${utc(b.eventDate, end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${b.eventDate.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${nextDay(b.eventDate)}`);
    }
    lines.push(`SUMMARY:${icsText(summary)}`);
    if (b.location) lines.push(`LOCATION:${icsText(b.location)}`);
    if (description) lines.push(`DESCRIPTION:${icsText(description)}`);
    lines.push(`STATUS:${b.status === "option" ? "TENTATIVE" : "CONFIRMED"}`);
    if (b.kind !== "block")
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(summary)}`, "TRIGGER:-P1D", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
