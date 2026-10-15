// Her gün çalışır: süresi dolan ilanlar ve dopingler önbellekteki sayfalardan da düşsün diye CDN'i temizler,
// bir yıldan eski teklif taleplerini siler, ziyaret istatistiklerini günlük özetlere toplar.
import { compactAnalytics } from "../lib/analytics.mjs";
import { purgeSite } from "../lib/cache.mjs";
import { purgeOldRequests } from "../lib/requests.mjs";

export default async () => {
  await purgeSite();
  await purgeOldRequests();
  await compactAnalytics();
};

export const config = { schedule: "@daily" };
