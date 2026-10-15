// Promosyon (indirim) kodları — PRD "sosyal medya indirim kodu" modülü.
import { getStore } from "@netlify/blobs";
import { HttpError } from "./http.mjs";
import { PACKAGES } from "./pricing.mjs";

const promoStore = () => getStore({ name: "promos", consistency: "strong" });
export const normalizeCode = (code) =>
  String(code || "")
    .trim()
    .toLocaleUpperCase("tr")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 30);

export async function listPromos() {
  const store = promoStore();
  const { blobs } = await store.list();
  const promos = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return promos.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function savePromo(input) {
  const code = normalizeCode(input.code);
  if (code.length < 3) throw new HttpError(400, "Kod en az 3 karakter olmalı (harf ve rakam).");
  const percent = Math.round(Number(input.discountPercent));
  if (!(percent >= 1 && percent <= 100)) throw new HttpError(400, "İndirim oranı 1 ile 100 arasında olmalı.");
  const pkg = PACKAGES[input.package] ? input.package : "";
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(String(input.expiresAt || "")) ? input.expiresAt : "";
  const store = promoStore();
  const existing = await store.get(code, { type: "json" });
  const promo = {
    code,
    discountPercent: percent,
    package: pkg,
    maxUses: Math.max(0, Math.round(Number(input.maxUses) || 0)),
    expiresAt,
    active: input.active !== false,
    note: String(input.note || "").slice(0, 200),
    usedCount: existing?.usedCount || 0,
    usedBy: existing?.usedBy || [],
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  await store.setJSON(code, promo);
  return promo;
}

export const deletePromo = (code) => promoStore().delete(normalizeCode(code));

// Kodun bu paket ve üye için kullanılabilir olup olmadığını kontrol eder.
export async function checkPromo(code, { pkg, userId }) {
  const promo = await promoStore().get(normalizeCode(code), { type: "json" });
  if (!promo || !promo.active) throw new HttpError(400, "Bu indirim kodu geçerli değil.");
  if (promo.expiresAt && promo.expiresAt < new Date().toISOString().slice(0, 10)) {
    throw new HttpError(400, "Bu indirim kodunun süresi dolmuş.");
  }
  if (promo.maxUses && promo.usedCount >= promo.maxUses)
    throw new HttpError(400, "Bu indirim kodunun kullanım limiti dolmuş.");
  if (promo.package && pkg && promo.package !== pkg) {
    throw new HttpError(400, `Bu kod yalnızca ${PACKAGES[promo.package].label} paket için geçerli.`);
  }
  if (userId && promo.usedBy.includes(userId)) throw new HttpError(400, "Bu kodu daha önce kullandınız.");
  return promo;
}

// Kullanım sayısını aynı anda gelen isteklerde bile aşmadan artırır.
export async function redeemPromo(code, userId) {
  const store = promoStore();
  const key = normalizeCode(code);
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store.getWithMetadata(key, { type: "json" });
    if (!current) throw new HttpError(400, "Bu indirim kodu geçerli değil.");
    const promo = current.data;
    if (promo.maxUses && promo.usedCount >= promo.maxUses)
      throw new HttpError(400, "Bu indirim kodunun kullanım limiti dolmuş.");
    if (promo.usedBy.includes(userId)) throw new HttpError(400, "Bu kodu daha önce kullandınız.");
    promo.usedCount += 1;
    promo.usedBy.push(userId);
    const result = await store.setJSON(key, promo, { onlyIfMatch: current.etag });
    if (result.modified) return promo;
  }
  throw new HttpError(503, "Sistem şu an yoğun, lütfen tekrar deneyin.");
}
