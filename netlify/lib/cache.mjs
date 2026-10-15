import { purgeCache } from "@netlify/functions";

// Kayıttan sonra CDN'deki sayfa kopyasını temizler; böylece değişiklik anında yayına girer.
export async function purgeSite() {
  try {
    await purgeCache();
  } catch (err) {
    console.warn("CDN önbelleği temizlenemedi (birkaç dakika içinde kendiliğinden yenilenir):", err.message);
  }
}
