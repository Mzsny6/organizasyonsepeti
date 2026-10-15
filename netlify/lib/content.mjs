import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { DEFAULT_CONTENT, ITEM_TEMPLATES } from "./defaults.mjs";
import { slugify } from "./text.mjs";

export const siteStore = () => getStore({ name: "site", consistency: "strong" });
export const mediaStore = () => getStore({ name: "media", consistency: "strong" });
export const messageStore = () => getStore({ name: "messages", consistency: "strong" });

const HISTORY_LIMIT = 20;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => (v === undefined || v === null ? "" : String(v)).slice(0, max);
export const newId = () => randomBytes(5).toString("hex");

// Gelen veriyi varsayılan içeriğin şekline göre düzenler: bilinmeyen alanları atar,
// eksik alanları varsayılanla doldurur, tipleri ve uzunlukları sınırlar.
function normalize(value, shape, key) {
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return structuredClone(shape);
    const tpl = ITEM_TEMPLATES[key];
    if (tpl)
      return value
        .filter(isObj)
        .slice(0, 300)
        .map((item) => normalizeItem(item, tpl));
    return value
      .map((v) => str(v, 300).trim())
      .filter(Boolean)
      .slice(0, 40);
  }
  if (isObj(shape)) {
    const src = isObj(value) ? value : {};
    const out = {};
    for (const k of Object.keys(shape)) out[k] = normalize(src[k], shape[k], k);
    return out;
  }
  if (value === undefined || value === null) return shape;
  if (typeof shape === "boolean") return Boolean(value);
  if (typeof shape === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : shape;
  }
  return str(value, 20000);
}

function normalizeItem(item, tpl) {
  const out = normalize(item, tpl);
  if (!/^[a-z0-9-]{1,40}$/i.test(out.id)) out.id = newId();
  if ("rating" in out) out.rating = Math.min(5, Math.max(1, Math.round(out.rating) || 5));
  return out;
}

export function normalizeContent(input) {
  const content = normalize(input, DEFAULT_CONTENT);
  content.settings.whatsapp = normalizeWhatsapp(content.settings.whatsapp);
  normalizeAndroid(content.settings);
  content.categories = normalizeSlugged(content.categories).map((c) => ({
    ...c,
    tier: [1, 2, 3].includes(Math.round(c.tier)) ? Math.round(c.tier) : 3,
  }));
  content.events = normalizeSlugged(content.events);
  const { tiers, dopings } = content.pricing;
  for (const tier of Object.values(tiers))
    for (const k of ["monthly", "quarterly", "yearly"]) tier[k] = Math.max(0, tier[k]);
  for (const d of Object.values(dopings)) {
    d.price = Math.max(0, d.price);
    d.days = Math.min(365, Math.max(1, Math.round(d.days)));
  }
  content.pricing.bank.iban = content.pricing.bank.iban.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
  content.security.blacklistThreshold = Math.min(10, Math.max(1, Math.round(content.security.blacklistThreshold)));
  return content;
}

// Google Play uygulaması: paket adı, imza parmak izleri (SHA-256, satır başına bir tane) ve mağaza bağlantısı
function normalizeAndroid(settings) {
  const pkg = settings.androidPackage.trim();
  settings.androidPackage = /^[a-zA-Z]\w*(\.[a-zA-Z]\w*)+$/.test(pkg) ? pkg.slice(0, 100) : "";
  settings.androidSha256 = (settings.androidSha256.toUpperCase().match(/([0-9A-F]{2}:){31}[0-9A-F]{2}/g) || [])
    .slice(0, 5)
    .join("\n");
  const url = settings.playStoreUrl.trim();
  settings.playStoreUrl = /^https:\/\/play\.google\.com\//.test(url) ? url.slice(0, 300) : "";
}

// Kategori ve etkinlik adresleri (/ilanlar?kategori=...) benzersiz olmalı; boşsa addan üretilir.
function normalizeSlugged(categories) {
  const seen = new Set();
  return categories
    .filter((c) => c.name.trim())
    .map((c) => {
      let slug = slugify(c.slug || c.name, "kategori");
      for (let n = 2; seen.has(slug); n++) slug = `${slugify(c.slug || c.name, "kategori")}-${n}`;
      seen.add(slug);
      return { ...c, name: c.name.trim(), slug };
    });
}

// wa.me bağlantısı için numarayı ülke koduyla, yalnızca rakam olarak saklar (0532... -> 90532...).
function normalizeWhatsapp(value) {
  const digits = value.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `9${digits}`;
  if (/^5\d{9}$/.test(digits)) return `90${digits}`;
  return digits;
}

export async function getContent() {
  const saved = await siteStore().get("content", { type: "json" });
  return normalizeContent(saved ?? {});
}

export async function saveContent(input) {
  const store = siteStore();
  const content = normalizeContent(input);
  const previous = await store.get("content", { type: "json" });
  if (previous) {
    await store.setJSON(`history/${Date.now()}`, previous);
    await trimHistory(store);
  }
  await store.setJSON("content", content);
  return content;
}

async function trimHistory(store) {
  const { blobs } = await store.list({ prefix: "history/" });
  const keys = blobs.map((b) => b.key).sort();
  const extra = keys.slice(0, Math.max(0, keys.length - HISTORY_LIMIT));
  await Promise.all(extra.map((key) => store.delete(key)));
}

export async function listHistory() {
  const { blobs } = await siteStore().list({ prefix: "history/" });
  return blobs
    .map((b) => Number(b.key.slice("history/".length)))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
}

export async function restoreHistory(timestamp) {
  const store = siteStore();
  const snapshot = await store.get(`history/${Number(timestamp)}`, { type: "json" });
  if (!snapshot) return null;
  return saveContent(snapshot);
}

// Bir içerikte kullanılan /media/... görsel anahtarları.
export function usedMediaKeys(content) {
  const keys = new Set();
  JSON.stringify(content).replace(/\/media\/([a-z0-9.-]+)/gi, (_, key) => keys.add(key));
  return keys;
}
