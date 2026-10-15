// Arama adresleri. Tek filtreli ya da "hizmet + il" aramaları arama motorları için temiz adreslerle sunulur:
//   /hizmet/dugun-salonu, /hizmet/dugun-salonu/istanbul, /il/istanbul, /etkinlik/kina
// Diğer tüm filtre birleşimleri /ilanlar?... adresinde kalır.
import { CITY_NAMES } from "../../../public/assets/js/locations.js";
import { slugify } from "../text.mjs";

const CITY_BY_SLUG = new Map(CITY_NAMES.map((name) => [slugify(name), name]));
export const citySlug = (name) => slugify(name, "il");
export const cityFromSlug = (slug) => CITY_BY_SLUG.get(String(slug || "")) || "";

const KEYS = ["q", "kategori", "etkinlik", "il", "ilce", "min", "max", "sirala", "sayfa"];

// values: parseSearch çıktısı ya da { kategori, il, etkinlik, ... } (slug ve il adı)
export function searchPath(values, overrides = {}) {
  const merged = { ...values, ...overrides };
  const set = {};
  for (const key of KEYS) {
    const v = merged[key];
    if (!v || (key === "sirala" && v === "onerilen") || (key === "sayfa" && Number(v) <= 1)) continue;
    set[key] = v;
  }
  const page = set.sayfa ? `?sayfa=${set.sayfa}` : "";
  const keys = Object.keys(set)
    .filter((k) => k !== "sayfa")
    .sort()
    .join(",");
  if (keys === "kategori") return `/hizmet/${set.kategori}${page}`;
  if (keys === "il,kategori") return `/hizmet/${set.kategori}/${citySlug(set.il)}${page}`;
  if (keys === "il") return `/il/${citySlug(set.il)}${page}`;
  if (keys === "etkinlik") return `/etkinlik/${set.etkinlik}${page}`;
  const params = new URLSearchParams();
  for (const key of KEYS) if (set[key]) params.set(key, set[key]);
  const qs = params.toString();
  return `/ilanlar${qs ? `?${qs}` : ""}`;
}

export const isLandingPath = (path) => !path.startsWith("/ilanlar");
