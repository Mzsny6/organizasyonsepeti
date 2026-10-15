import { sha256 } from "./crypto.mjs";
import { siteStore } from "./content.mjs";

// Basit sayaç tabanlı sınırlama. Kişisel veri saklamamak için anahtarın (IP, e-posta) özeti tutulur.
const limitKey = (bucket, id) => `limits/${bucket}/${sha256(id || "unknown").slice(0, 32)}`;

export async function isLimited(bucket, id, max, windowMs) {
  const record = await siteStore().get(limitKey(bucket, id), { type: "json" });
  return Boolean(record && Date.now() - record.first < windowMs && record.count >= max);
}

export async function countHit(bucket, id, windowMs) {
  const store = siteStore();
  const key = limitKey(bucket, id);
  let record = await store.get(key, { type: "json" });
  if (!record || Date.now() - record.first >= windowMs) record = { first: Date.now(), count: 0 };
  record.count += 1;
  await store.setJSON(key, record);
}

export const resetHits = (bucket, id) => siteStore().delete(limitKey(bucket, id));

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
