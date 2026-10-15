// İlan iletişim tıklama sayaçları (PRD: phone_clicks, whatsapp_clicks).
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "stats", consistency: "strong" });
export const CLICK_TYPES = ["phone", "whatsapp"];

export async function countClick(listingId, type) {
  if (!CLICK_TYPES.includes(type)) return;
  const key = `l/${listingId}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await store().getWithMetadata(key, { type: "json" });
    const stats = current?.data || { phone: 0, whatsapp: 0 };
    stats[type] = (stats[type] || 0) + 1;
    const result = current
      ? await store().setJSON(key, stats, { onlyIfMatch: current.etag })
      : await store().setJSON(key, stats, { onlyIfNew: true });
    if (result.modified) return;
  }
}

export async function statsFor(ids) {
  const entries = await Promise.all(
    ids.map(async (id) => [id, (await store().get(`l/${id}`, { type: "json" })) || { phone: 0, whatsapp: 0 }]),
  );
  return Object.fromEntries(entries);
}

export const deleteStats = (listingId) => store().delete(`l/${listingId}`);
