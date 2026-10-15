// İlan sayaçları: görüntülenme, iletişim tıklamaları (PRD: phone_clicks, whatsapp_clicks) ve teklif talebi sayısı.
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "stats", consistency: "strong" });
export const CLICK_TYPES = ["phone", "whatsapp"];
const STAT_TYPES = [...CLICK_TYPES, "request", "view"];
const EMPTY = { view: 0, phone: 0, whatsapp: 0, request: 0 };

export async function countClick(listingId, type) {
  if (!STAT_TYPES.includes(type)) return;
  const key = `l/${listingId}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await store().getWithMetadata(key, { type: "json" });
    const stats = current?.data || { ...EMPTY };
    stats[type] = (stats[type] || 0) + 1;
    const result = current
      ? await store().setJSON(key, stats, { onlyIfMatch: current.etag })
      : await store().setJSON(key, stats, { onlyIfNew: true });
    if (result.modified) return;
  }
}

export async function statsFor(ids) {
  const entries = await Promise.all(
    ids.map(async (id) => [id, { ...EMPTY, ...(await store().get(`l/${id}`, { type: "json" })) }]),
  );
  return Object.fromEntries(entries);
}

export const deleteStats = (listingId) => store().delete(`l/${listingId}`);
