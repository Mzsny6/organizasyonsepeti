// Veri tabanı gerektirmeyen saf fonksiyonların testleri.
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeContent } from "../netlify/lib/content.mjs";
import { firmPath, isLive, parseFirmParam, parseListingParam, searchIndex } from "../netlify/lib/listings.mjs";
import { applyDiscount, packagePrice } from "../netlify/lib/pricing.mjs";
import { cityFromSlug, citySlug, searchPath } from "../netlify/lib/render/urls.mjs";
import { validateRequest } from "../netlify/lib/requests.mjs";
import { foldText, slugify } from "../netlify/lib/text.mjs";
import { formatPhone, maskPhone, normalizeMobile, validateTcVkn } from "../netlify/lib/users.mjs";

const content = normalizeContent({});
const future = (days) => new Date(Date.now() + days * 864e5).toISOString();

test("telefon numaraları", () => {
  for (const input of ["0532 111 22 33", "5321112233", "+90 532 111 22 33", "90-532-111-2233"]) {
    assert.equal(normalizeMobile(input), "905321112233", input);
  }
  assert.equal(normalizeMobile("0212 111 22 33"), "", "sabit hat cep telefonu sayılmaz");
  assert.equal(normalizeMobile("123"), "");
  assert.equal(formatPhone("905321112233"), "0532 111 22 33");
  assert.equal(maskPhone("905321112233"), "0532 *** ** 33");
});

test("T.C. kimlik ve vergi numarası", () => {
  assert.equal(validateTcVkn("10000000146"), "10000000146");
  assert.equal(validateTcVkn("123 456 7890"), "1234567890", "10 haneli vergi numarası");
  assert.throws(() => validateTcVkn("12345678901"));
  assert.throws(() => validateTcVkn("01234567890"));
  assert.throws(() => validateTcVkn(""));
});

test("Türkçe metin ve adresler", () => {
  assert.equal(foldText("Düğün Salonu ŞIK"), "dugun salonu sik");
  assert.equal(slugify("Kına Gecesi & Nişan!"), "kina-gecesi-nisan");
  assert.equal(slugify("   ", "firma"), "firma");
  assert.equal(parseListingParam("dugun-fotografcisi-a1b2c3d4e5"), "a1b2c3d4e5");
  assert.equal(parseListingParam("gecersiz"), null);
  const path = firmPath({ company: "Anı Fotoğraf", userId: "a1b2c3d4e5f6" });
  assert.equal(path, "/firma/ani-fotograf-a1b2c3d4e5f6");
  assert.equal(parseFirmParam(path.slice(7)), "a1b2c3d4e5f6");
});

test("kademeli paket fiyatları (PRD tablosu)", () => {
  assert.equal(packagePrice(content, "dugun-salonu", "monthly"), 1250);
  assert.equal(packagePrice(content, "dugun-salonu", "quarterly"), 3000);
  assert.equal(packagePrice(content, "dugun-salonu", "yearly"), 12500);
  assert.equal(packagePrice(content, "fotografci", "monthly"), 550);
  assert.equal(packagePrice(content, "fotografci", "quarterly"), 1320);
  assert.equal(packagePrice(content, "palyaco", "monthly"), 250);
  assert.equal(packagePrice(content, "palyaco", "yearly"), 2500);
  assert.equal(applyDiscount(1320, 100), 0);
  assert.equal(applyDiscount(1000, 25), 750);
  const free = normalizeContent({ pricing: { freeMode: true } });
  assert.equal(packagePrice(free, "dugun-salonu", "yearly"), 0);
});

test("arama: süresi dolan ilan gizlenir, kategori üst sıra dopingi öne çıkar", () => {
  const base = {
    status: "active",
    city: "İstanbul",
    district: "Kadıköy",
    events: [],
    dopings: {},
    priceMin: 1000,
    text: "fotograf",
  };
  const index = [
    { ...base, id: "a", category: "fotografci", expiresAt: future(10), publishedAt: future(-1) },
    { ...base, id: "b", category: "fotografci", expiresAt: future(10), publishedAt: future(-5) },
    {
      ...base,
      id: "c",
      category: "fotografci",
      expiresAt: future(10),
      publishedAt: future(-9),
      dopings: { categoryTop: future(3) },
    },
    { ...base, id: "d", category: "fotografci", expiresAt: future(-1), publishedAt: future(-2) },
    { ...base, id: "e", category: "palyaco", expiresAt: future(10), publishedAt: future(-1.5) },
    { ...base, id: "f", category: "fotografci", status: "pending", expiresAt: future(10), publishedAt: "" },
  ];
  assert.equal(isLive(index[3]), false);
  const all = searchIndex(index, {});
  assert.deepEqual(
    all.items.map((x) => x.id),
    ["a", "e", "b", "c"],
  );
  const category = searchIndex(index, { category: "fotografci" });
  assert.deepEqual(
    category.items.map((x) => x.id),
    ["c", "a", "b"],
    "doping yalnızca kendi kategorisinde öne çıkarır",
  );
  assert.equal(searchIndex(index, { max: 500 }).total, 0);
  assert.equal(searchIndex(index, { q: "Fotoğraf" }).total, 4);
});

test("teklif talebi doğrulaması", () => {
  const ok = validateRequest(
    { name: " Mehmet  Kaya ", guests: "1.500", event: "kina", message: "Kına gecesi için fiyat almak istiyorum." },
    content,
  );
  assert.equal(ok.name, "Mehmet Kaya");
  assert.equal(ok.guests, 1500);
  assert.equal(ok.event, "kina");
  assert.equal(validateRequest({ name: "Ali", event: "yok", message: "Yeterince uzun bir mesaj." }, content).event, "");
  assert.throws(() => validateRequest({ name: "A", message: "Yeterince uzun bir mesaj." }, content));
  assert.throws(() => validateRequest({ name: "Ali", message: "kısa" }, content));
  assert.throws(() => validateRequest({ name: "Ali", eventDate: "2001-01-01", message: "Yeterince uzun." }, content));
  assert.throws(() => validateRequest({ name: "Ali", eventDate: "31-12-2099", message: "Yeterince uzun." }, content));
});

test("arama adresleri: temiz adresler ve /ilanlar", () => {
  assert.equal(searchPath({ kategori: "dugun-salonu" }), "/hizmet/dugun-salonu");
  assert.equal(searchPath({ kategori: "dugun-salonu", il: "İstanbul" }), "/hizmet/dugun-salonu/istanbul");
  assert.equal(searchPath({ il: "Şanlıurfa" }), "/il/sanliurfa");
  assert.equal(searchPath({ etkinlik: "kina", sayfa: 2 }), "/etkinlik/kina?sayfa=2");
  assert.equal(searchPath({ kategori: "palyaco", sirala: "onerilen", sayfa: 1 }), "/hizmet/palyaco");
  assert.equal(searchPath({ kategori: "palyaco", sirala: "yeni" }), "/ilanlar?kategori=palyaco&sirala=yeni");
  assert.equal(
    searchPath({ kategori: "palyaco", il: "İzmir", ilce: "Bornova" }),
    "/ilanlar?kategori=palyaco&il=%C4%B0zmir&ilce=Bornova",
  );
  assert.equal(searchPath({}), "/ilanlar");
  assert.equal(cityFromSlug(citySlug("Çanakkale")), "Çanakkale");
  assert.equal(cityFromSlug("atlantis"), "");
});
