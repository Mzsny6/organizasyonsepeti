// Ziyaret istatistikleri (yönetim paneli > Ziyaret istatistikleri).
// Çerez kullanılmaz ve IP adresi saklanmaz: ziyaretçi, SHA-256(gizli tuz + gün + IP + tarayıcı) ile
// her gün değişen anonim bir kimlikle sayılır.
//   live/<gün>/<0-7>  günün sayaçları; aynı ziyaretçi hep aynı parçaya yazılır (eş zamanlı yazmalar dağılır)
//   day/<gün>         geçmiş günlerin birleştirilmiş özeti (günlük görev oluşturur, parçaları siler)
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { sha256 } from "./crypto.mjs";

const store = () => getStore({ name: "analytics", consistency: "strong" });
const SHARDS = 8;
const KEEP_DAYS = 400;
const MAX_KEYS = 600; // parça başına en fazla farklı sayfa / şehir / arama
const TR_OFFSET = 3 * 3600e3; // Türkiye saati (UTC+3)
export const EVENTS = ["phone", "whatsapp", "request", "review", "signup", "listing"];

export const trDate = (ms = Date.now()) => new Date(ms + TR_OFFSET).toISOString().slice(0, 10);
const trHour = (ms = Date.now()) => new Date(ms + TR_OFFSET).getUTCHours();
const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);

const emptyDay = () => ({
  views: 0,
  visitors: {},
  pages: {},
  sources: {},
  devices: {},
  browsers: {},
  cities: {},
  searches: {},
  events: {},
  hours: Array(24).fill(0),
});

let cachedSalt = "";
async function salt() {
  if (cachedSalt) return cachedSalt;
  const s = store();
  await s.set("salt", randomBytes(16).toString("hex"), { onlyIfNew: true });
  cachedSalt = await s.get("salt");
  return cachedSalt;
}

/* ---------- Sınıflandırma ---------- */

export function deviceOf(ua) {
  if (/iPad|Tablet|SM-T\d|Nexus (7|9|10)|Kindle|Silk/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "Mobil";
  return "Masaüstü";
}

export function browserOf(ua) {
  const rules = [
    [/Instagram/i, "Instagram uygulaması"],
    [/FBAN|FBAV|FB_IAB/i, "Facebook uygulaması"],
    [/TikTok|musical_ly/i, "TikTok uygulaması"],
    [/SamsungBrowser/i, "Samsung Internet"],
    [/Edg\//i, "Edge"],
    [/OPR\/|Opera/i, "Opera"],
    [/YaBrowser/i, "Yandex"],
    [/CriOS|Chrome\//i, "Chrome"],
    [/FxiOS|Firefox\//i, "Firefox"],
    [/Safari\//i, "Safari"],
  ];
  return rules.find(([re]) => re.test(ua))?.[1] || "Diğer";
}

const SOURCES = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)yandex\./, "Yandex"],
  [/instagram\.com$/, "Instagram"],
  [/facebook\.com$|fb\.me$/, "Facebook"],
  [/(^|\.)t\.co$|twitter\.com$|(^|\.)x\.com$/, "X (Twitter)"],
  [/tiktok\.com$/, "TikTok"],
  [/whatsapp\.com$|wa\.me$/, "WhatsApp"],
  [/youtube\.com$|youtu\.be$/, "YouTube"],
  [/pinterest\./, "Pinterest"],
];

// Ziyaretin nereden geldiği. Site içi gezinti için null döner (kaynak yalnızca girişte sayılır).
export function sourceOf(ref, utm, siteHost) {
  const tag = String(utm || "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9ğüşıöç_.-]/g, "")
    .slice(0, 30);
  if (tag === "uygulama") return "Android / uygulama";
  if (tag) return SOURCES.find(([re]) => re.test(`${tag}.com`))?.[1] || tag;
  if (!ref) return "Doğrudan";
  let host;
  try {
    host = new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return "Doğrudan";
  }
  if (host === String(siteHost || "").replace(/^www\./, "")) return null;
  return SOURCES.find(([re]) => re.test(host))?.[1] || host.slice(0, 60);
}

export function cityOf(geo) {
  if (!geo?.country?.code) return "Bilinmiyor";
  if (geo.country.code !== "TR") return `Yurt dışı (${geo.country.code})`;
  return String(geo.subdivision?.name || geo.city || "Türkiye").slice(0, 40);
}

// Yalnızca herkese açık sayfalar sayılır; adres sorgu parametresi olmadan saklanır.
export function normalizePath(path) {
  const p = String(path || "").split(/[?#]/)[0];
  if (!/^\/[A-Za-z0-9\-._~/%]*$/.test(p) || p.length > 120) return "";
  if (/^\/(api|admin|hesap|\.netlify)(\/|$)/.test(p)) return "";
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/* ---------- Yazma ---------- */

const bump = (map, key, by = 1) => {
  if (!key) return;
  if (!(key in map) && Object.keys(map).length >= MAX_KEYS) key = "(diğer)";
  map[key] = (map[key] || 0) + by;
};

// İstatistik en iyi çabayla yazılır; çakışmada birkaç kez denenir, olmazsa sessizce geçilir.
async function updateShard(key, mutate) {
  const s = store();
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await s.getWithMetadata(key, { type: "json" });
    const data = current?.data || emptyDay();
    mutate(data);
    const result = current
      ? await s.setJSON(key, data, { onlyIfMatch: current.etag })
      : await s.setJSON(key, data, { onlyIfNew: true });
    if (result.modified) return;
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));
  }
}

export async function recordPageview({ path, ref, utm, q }, { ip, ua, geo, siteHost }) {
  const page = normalizePath(path);
  if (!page) return false;
  const now = Date.now();
  const date = trDate(now);
  const visitor = sha256(`${await salt()}:${date}:${ip}:${ua}`).slice(0, 16);
  const shard = Number.parseInt(visitor.slice(0, 2), 16) % SHARDS;
  const source = sourceOf(ref, utm, siteHost);
  const term = String(q || "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ")
    .slice(0, 40);
  await updateShard(`live/${date}/${shard}`, (d) => {
    const isNew = !d.visitors[visitor];
    d.views += 1;
    d.visitors[visitor] = (d.visitors[visitor] || 0) + 1;
    d.hours[trHour(now)] += 1;
    bump(d.pages, page);
    if (term) bump(d.searches, term);
    if (source) bump(d.sources, source);
    if (isNew) {
      bump(d.devices, deviceOf(ua));
      bump(d.browsers, browserOf(ua));
      bump(d.cities, cityOf(geo));
    }
  });
  return true;
}

export async function recordEvent(type) {
  if (!EVENTS.includes(type)) return;
  const date = trDate();
  const shard = Math.floor(Math.random() * SHARDS);
  await updateShard(`live/${date}/${shard}`, (d) => bump(d.events, type)).catch((err) =>
    console.warn("İstatistik yazılamadı:", err.message),
  );
}

/* ---------- Okuma ---------- */

function mergeInto(total, day) {
  total.views += day.views;
  total.visitors += typeof day.visitors === "number" ? day.visitors : Object.keys(day.visitors || {}).length;
  for (const field of ["pages", "sources", "devices", "browsers", "cities", "searches", "events"]) {
    for (const [key, n] of Object.entries(day[field] || {})) total[field][key] = (total[field][key] || 0) + n;
  }
  day.hours?.forEach((n, i) => (total.hours[i] += n));
  return total;
}

const emptyTotal = () => ({ ...emptyDay(), visitors: 0 });

async function readLiveDay(date) {
  const s = store();
  const shards = await Promise.all(
    Array.from({ length: SHARDS }, (_, i) => s.get(`live/${date}/${i}`, { type: "json" })),
  );
  return shards.filter(Boolean).reduce(mergeInto, emptyTotal());
}

async function readDay(date, today) {
  if (date === today) return readLiveDay(date);
  return (await store().get(`day/${date}`, { type: "json" })) || readLiveDay(date);
}

const top = (map, limit) =>
  Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));

// days: 1 (bugün), 7, 30, 90. Önceki eş dönemin toplamları da döner (karşılaştırma için).
export async function analyticsReport(days) {
  const today = trDate();
  const dates = Array.from({ length: days }, (_, i) => shiftDate(today, i - days + 1));
  const previousDates = dates.map((d) => shiftDate(d, -days));
  const [current, previous] = await Promise.all([
    Promise.all(dates.map((d) => readDay(d, today))),
    Promise.all(previousDates.map((d) => readDay(d, today))),
  ]);
  const total = current.reduce(mergeInto, emptyTotal());
  const before = previous.reduce(mergeInto, emptyTotal());
  return {
    from: dates[0],
    to: today,
    totals: { views: total.views, visitors: total.visitors, events: total.events },
    previous: { views: before.views, visitors: before.visitors, events: before.events },
    daily: dates.map((date, i) => ({ date, views: current[i].views, visitors: current[i].visitors })),
    hours: total.hours,
    pages: top(total.pages, 20),
    sources: top(total.sources, 12),
    cities: top(total.cities, 15),
    devices: top(total.devices, 3),
    browsers: top(total.browsers, 8),
    searches: top(total.searches, 15),
  };
}

/* ---------- Günlük bakım ---------- */

// Bugünden önceki günlerin parçalarını tek kayda toplar, çok eski günleri siler.
export async function compactAnalytics() {
  const s = store();
  const today = trDate();
  const { blobs } = await s.list({ prefix: "live/" });
  const pastDates = [...new Set(blobs.map((b) => b.key.split("/")[1]))].filter((d) => d < today);
  for (const date of pastDates) {
    const day = await readLiveDay(date);
    await s.setJSON(`day/${date}`, day);
    await Promise.all(blobs.filter((b) => b.key.startsWith(`live/${date}/`)).map((b) => s.delete(b.key)));
  }
  const cutoff = shiftDate(today, -KEEP_DAYS);
  const { blobs: days } = await s.list({ prefix: "day/" });
  await Promise.all(days.filter((b) => b.key.slice(4) < cutoff).map((b) => s.delete(b.key)));
}
