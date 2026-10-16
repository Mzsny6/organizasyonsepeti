// Veri tabanı gerektirmeyen saf fonksiyonların testleri.
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeContent } from "../netlify/lib/content.mjs";
import { firmPath, isLive, parseFirmParam, parseListingParam, searchIndex } from "../netlify/lib/listings.mjs";
import { applyDiscount, packagePrice } from "../netlify/lib/pricing.mjs";
import { cityFromSlug, citySlug, searchPath } from "../netlify/lib/render/urls.mjs";
import { validateRequest } from "../netlify/lib/requests.mjs";
import { displayName, validateReview } from "../netlify/lib/reviews.mjs";
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

test("değerlendirme doğrulaması ve görünen ad", () => {
  assert.equal(displayName("mehmet  ali kaya"), "mehmet K.");
  assert.equal(displayName("Zeynep"), "Zeynep");
  assert.equal(displayName("Ayşe ışık"), "Ayşe I.");
  const ok = validateReview({ rating: "5", name: "Ayşe Yılmaz", comment: "Her şey için çok teşekkürler, harikaydı!" });
  assert.equal(ok.rating, 5);
  assert.equal(ok.authorName, "Ayşe Y.");
  assert.throws(() => validateReview({ rating: 0, name: "Ali", comment: "Yeterince uzun bir yorum metni." }));
  assert.throws(() => validateReview({ rating: 6, name: "Ali", comment: "Yeterince uzun bir yorum metni." }));
  assert.throws(() => validateReview({ rating: 3, name: "Ali", comment: "kısa" }));
});

test("ziyaret istatistiği sınıflandırması", async () => {
  const { browserOf, cityOf, deviceOf, normalizePath, sourceOf } = await import("../netlify/lib/analytics.mjs");
  assert.equal(sourceOf("https://www.google.com.tr/", "", "organizasyonsepeti.net"), "Google");
  assert.equal(sourceOf("https://l.instagram.com/?u=x", "", "organizasyonsepeti.net"), "Instagram");
  assert.equal(sourceOf("https://organizasyonsepeti.net/ilanlar", "", "organizasyonsepeti.net"), null);
  assert.equal(sourceOf("", "", "organizasyonsepeti.net"), "Doğrudan");
  assert.equal(sourceOf("", "WhatsApp", "x"), "WhatsApp");
  assert.equal(sourceOf("", "uygulama", "x"), "Android / uygulama");
  assert.equal(sourceOf("https://blog.ornek.com/yazi", "", "x"), "blog.ornek.com");
  assert.equal(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148"), "Mobil");
  assert.equal(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "Tablet");
  assert.equal(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15"), "Masaüstü");
  assert.equal(browserOf("Mozilla/5.0 (Linux; Android 14) SamsungBrowser/25.0 Chrome/121 Mobile"), "Samsung Internet");
  assert.equal(browserOf("Mozilla/5.0 (iPhone) Instagram 300.0"), "Instagram uygulaması");
  assert.equal(browserOf("Mozilla/5.0 (iPhone) Version/17.0 Mobile/15E148 Safari/604.1"), "Safari");
  assert.equal(cityOf({ country: { code: "TR" }, subdivision: { name: "İzmir" } }), "İzmir");
  assert.equal(cityOf({ country: { code: "DE" } }), "Yurt dışı (DE)");
  assert.equal(cityOf(undefined), "Bilinmiyor");
  assert.equal(normalizePath("/ilanlar?q=kına"), "/ilanlar");
  assert.equal(normalizePath("/hizmet/palyaco/"), "/hizmet/palyaco");
  assert.equal(normalizePath("/admin/"), "");
  assert.equal(normalizePath("https://kotu.site/"), "");
  assert.equal(normalizePath('/"><script>'), "");
});

test("ajanda: çakışma kuralları ve telefon takvimi dosyası", async () => {
  const { bookingsToIcs, findConflicts } = await import("../netlify/lib/bookings.mjs");
  const job = (id, eventTime = "", endTime = "", extra = {}) => ({
    id,
    kind: "job",
    eventDate: "2026-11-20",
    eventTime,
    endTime,
    status: "confirmed",
    ...extra,
  });
  const morning = job("a", "10:00", "13:00");
  const evening = { kind: "job", eventDate: "2026-11-20", eventTime: "18:00", endTime: "22:00", status: "option" };
  assert.equal(findConflicts([morning], evening, 1).length, 1, "kapasite 1: aynı gün ikinci iş çakışır");
  assert.equal(findConflicts([morning], evening, 2).length, 0, "kapasite 2: saatler ayrıysa sorun yok");
  const overlap = { ...evening, eventTime: "12:00", endTime: "15:00" };
  assert.equal(findConflicts([morning], overlap, 5).length, 1, "saat çakışması kapasiteden bağımsız");
  assert.equal(findConflicts([morning, job("b", "14:00", "16:00")], evening, 2).length, 2, "kapasite dolunca");
  const closed = { id: "c", kind: "block", eventDate: "2026-11-20", eventTime: "", endTime: "", status: "confirmed" };
  assert.equal(findConflicts([closed], evening, 5).length, 1, "kapalı güne iş eklenemez");
  assert.equal(findConflicts([morning], { ...closed, id: undefined }, 5).length, 1, "işi olan gün kapatılırken uyarır");
  assert.equal(findConflicts([morning], { ...evening, status: "cancelled" }, 1).length, 0, "iptal kayıt çakışmaz");
  assert.equal(findConflicts([morning], { ...morning }, 1, "a").length, 0, "kendisiyle çakışmaz");

  const ics = bookingsToIcs({ company: "Anı Fotoğraf" }, [
    {
      ...morning,
      clientName: "Ayşe; Yılmaz",
      clientPhone: "0532 111 22 33",
      location: "Kadıköy, İstanbul",
      totalAmount: 15000,
      deposit: 5000,
      note: "Gelin evi çekimi",
      updatedAt: "2026-10-16T08:00:00.000Z",
    },
    { ...closed, note: "Yıllık izin", updatedAt: "2026-10-16T08:00:00.000Z" },
    { ...job("d"), status: "cancelled", updatedAt: "2026-10-16T08:00:00.000Z" },
  ]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261120T070000Z\r\n/, "Türkiye saati UTC'ye çevrilir");
  assert.match(ics, /SUMMARY:Ayşe\\; Yılmaz/);
  assert.match(ics, /LOCATION:Kadıköy\\, İstanbul/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121/, "kapalı gün tüm gün");
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2, "iptal kayıt takvime gitmez");
  assert.ok(
    ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75),
    "satırlar 75 baytı geçmez",
  );
});
