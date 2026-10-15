// Her gün çalışır: süresi dolan ilanlar ve dopingler önbellekteki sayfalardan da düşsün diye CDN'i temizler,
// bir yıldan eski teklif taleplerini siler.
import { purgeSite } from "../lib/cache.mjs";
import { purgeOldRequests } from "../lib/requests.mjs";

export default async () => {
  await purgeSite();
  await purgeOldRequests();
};

export const config = { schedule: "@daily" };
