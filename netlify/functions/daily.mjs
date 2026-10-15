// Her gün çalışır: süresi dolan ilanlar ve dopingler önbellekteki sayfalardan da düşsün diye CDN'i temizler.
import { purgeSite } from "../lib/cache.mjs";

export default async () => {
  await purgeSite();
};

export const config = { schedule: "@daily" };
