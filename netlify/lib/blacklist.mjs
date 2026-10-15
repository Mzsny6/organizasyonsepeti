// Kara liste: organizatörlerin "asılsız adres / kapıda iptal" ihbarları.
// Farklı organizatörlerden eşik sayısı kadar (varsayılan 2) ihbar alan numara kalıcı olarak engellenir.
import { getStore } from "@netlify/blobs";
import { sha256 } from "./crypto.mjs";
import { HttpError } from "./http.mjs";
import { maskPhone, normalizeMobile } from "./users.mjs";

const store = () => getStore({ name: "blacklist", consistency: "strong" });
export const BLACKLIST_REASONS = {
  "sahte-adres": "Asılsız ya da yanlış adres verdi",
  "kapida-iptal": "Adrese gidildiğinde iptal etti",
  "odeme-yapmadi": "Hizmet sonrası ödeme yapmadı",
  diger: "Diğer kötü niyetli davranış",
};

export async function reportPhone(organizer, input, threshold) {
  const mobile = normalizeMobile(input.phone);
  if (!mobile) throw new HttpError(400, "Lütfen müşterinin cep telefonu numarasını yazın (05xx...).");
  const reason = BLACKLIST_REASONS[input.reason] ? input.reason : "diger";
  const key = sha256(mobile);
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store().getWithMetadata(key, { type: "json" });
    const record = current?.data || { phone: mobile, reports: [], blocked: false, blockedAt: "" };
    if (record.reports.some((r) => r.organizerId === organizer.id))
      throw new HttpError(409, "Bu numarayı daha önce bildirdiniz.");
    record.reports.push({
      organizerId: organizer.id,
      company: organizer.company,
      reason,
      note: String(input.note || "")
        .trim()
        .slice(0, 500),
      createdAt: new Date().toISOString(),
    });
    if (!record.blocked && record.reports.length >= threshold) {
      record.blocked = true;
      record.blockedAt = new Date().toISOString();
    }
    const result = current
      ? await store().setJSON(key, record, { onlyIfMatch: current.etag })
      : await store().setJSON(key, record, { onlyIfNew: true });
    if (result.modified) return { reports: record.reports.length, blocked: record.blocked };
  }
  throw new HttpError(503, "Sistem şu an yoğun, lütfen tekrar deneyin.");
}

export async function phoneRecord(phone) {
  const mobile = normalizeMobile(phone);
  return mobile ? store().get(sha256(mobile), { type: "json" }) : null;
}

export const isBlacklisted = async (phone) => Boolean((await phoneRecord(phone))?.blocked);

export async function listBlacklist() {
  const { blobs } = await store().list();
  const records = await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" })));
  return records
    .filter(Boolean)
    .map((r) => ({ ...r, id: sha256(r.phone), masked: maskPhone(r.phone) }))
    .sort((a, b) => (b.reports.at(-1)?.createdAt || "").localeCompare(a.reports.at(-1)?.createdAt || ""));
}

export async function setBlocked(id, blocked) {
  const record = await store().get(String(id), { type: "json" });
  if (!record) throw new HttpError(404, "Kayıt bulunamadı.");
  record.blocked = Boolean(blocked);
  record.blockedAt = blocked ? new Date().toISOString() : "";
  await store().setJSON(String(id), record);
  return record;
}

export const deleteBlacklistRecord = (id) => store().delete(String(id));
