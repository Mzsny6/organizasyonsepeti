// Uçtan uca API testi: organizatör kaydı → promosyonlu paket → onay → arama → SMS doğrulama →
// iletişim → teklif talebi → şifre sıfırlama → kara liste. Çalıştırma: npm test
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ADMIN_PASSWORD, Client, startServer } from "./helpers.mjs";

let server;
let admin;
let organizer;
let client;
let listing;
const ORGANIZER_MOBILE = "905321112233";
const CLIENT_MOBILE = "905339998877";

before(async () => {
  server = await startServer();
  admin = new Client(server.base);
  organizer = new Client(server.base);
  client = new Client(server.base);
});

after(() => server?.stop());

const listingInput = {
  title: "Düğün ve nişan fotoğrafçılığı",
  category: "fotografci",
  city: "İstanbul",
  district: "Kadıköy",
  description: "Düğün, nişan ve kına gecelerinde profesyonel fotoğraf ve video çekimi yapıyoruz.",
  priceMin: "15000",
  priceNote: "başlayan fiyatlarla",
  phone: "0532 111 22 33",
  whatsapp: true,
  events: ["dugun", "kina"],
  images: [],
  package: "quarterly",
  promo: "MAYA3AY",
};

async function verifyPhone(c, mobile) {
  const sent = await c.post("/api/v1/auth/send-otp", { phone: `0${mobile.slice(2)}` });
  assert.equal(sent.status, 200, JSON.stringify(sent.data));
  const code = await server.otp(mobile);
  const verified = await c.post("/api/v1/auth/verify-otp", { phone: `0${mobile.slice(2)}`, code });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  return verified.data.user;
}

test("ana sayfa ve ilan listesi açılır", async () => {
  const home = await admin.get("/");
  assert.equal(home.status, 200);
  assert.match(home.data, /Organizasyon Sepeti/);
  assert.equal((await admin.get("/ilanlar")).status, 200);
  assert.equal((await admin.get("/olmayan-sayfa")).status, 404);
});

test("yönetici girişi ve promosyon kodu", async () => {
  assert.equal((await admin.post("/api/login", { password: "yanlis-sifre" })).status, 401);
  assert.equal((await admin.post("/api/login", { password: ADMIN_PASSWORD })).status, 200);
  const promo = await admin.post("/api/admin/promos", {
    code: "maya3ay",
    discountPercent: 100,
    package: "quarterly",
    maxUses: 100,
  });
  assert.equal(promo.status, 201);
  assert.equal(promo.data.promo.code, "MAYA3AY");
});

test("uygulama: manifest, çevrimdışı dosyası ve Android doğrulama dosyası", async () => {
  const manifest = await admin.get("/manifest.webmanifest");
  assert.equal(manifest.status, 200);
  assert.equal(manifest.data.id, "/");
  assert.equal((await admin.get("/sw.js")).status, 200);
  assert.equal((await admin.get("/offline.html")).status, 200);
  assert.deepEqual((await admin.get("/.well-known/assetlinks.json")).data, []);

  const content = (await admin.get("/api/content")).data;
  const fingerprint = Array.from({ length: 32 }, () => "AB").join(":");
  content.settings.androidPackage = "net.organizasyonsepeti.twa";
  content.settings.androidSha256 = fingerprint.toLowerCase();
  content.settings.playStoreUrl = "https://play.google.com/store/apps/details?id=net.organizasyonsepeti.twa";
  assert.equal((await admin.put("/api/content", content)).status, 200);
  const [link] = (await admin.get("/.well-known/assetlinks.json")).data;
  assert.equal(link.target.package_name, "net.organizasyonsepeti.twa");
  assert.deepEqual(link.target.sha256_cert_fingerprints, [fingerprint]);
  assert.match((await admin.get("/")).data, /Android uygulaması/);
});

test("organizatör kaydı, promosyonlu ilan ve onay", async () => {
  const bad = await organizer.post("/api/account/register", {
    name: "Ayşe Yılmaz",
    company: "Anı Fotoğraf",
    email: "ayse@example.com",
    phone: "0532 111 22 33",
    tcVkn: "12345678901",
    password: "sifre12345",
    acceptTerms: true,
  });
  assert.equal(bad.status, 400, "geçersiz T.C. kimlik numarası reddedilmeli");

  const reg = await organizer.post("/api/account/register", {
    name: "Ayşe Yılmaz",
    company: "Anı Fotoğraf",
    email: "ayse@example.com",
    phone: "0532 111 22 33",
    tcVkn: "1234567890",
    password: "sifre12345",
    acceptTerms: true,
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));

  const created = await organizer.post("/api/account/listings", listingInput);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.order.amount, 0, "MAYA3AY ile 3 aylık paket ücretsiz olmalı");
  assert.equal(created.data.order.status, "paid");
  listing = created.data.listing;
  assert.equal(listing.status, "pending");

  // Onaylanmadan yayında görünmez
  assert.equal((await client.get(`/api/v1/listings/${listing.id}`)).status, 404);

  const approved = await admin.post(`/api/admin/listings/${listing.id}/moderate`, { status: "active" });
  assert.equal(approved.status, 200, JSON.stringify(approved.data));

  const search = await client.get("/api/v1/listings?kategori=fotografci&il=%C4%B0stanbul");
  assert.equal(search.status, 200);
  assert.equal(search.data.total, 1);
  assert.equal(search.data.items[0].id, listing.id);
  assert.equal(search.data.items[0].phone, undefined, "arama sonucunda telefon yer almamalı");

  const page = await client.get(`/ilan/${listing.slug}-${listing.id}`);
  assert.equal(page.status, 200);
  assert.match(page.data, /Teklif İste/);
  assert.equal((await client.get(`/ilan/eski-baslik-${listing.id}`)).status, 301);
});

test("firma sayfası, site haritası ve favoriler", async () => {
  const page = await client.get(`/ilan/${listing.slug}-${listing.id}`);
  const firmHref = /href="(\/firma\/[^"]+)"/.exec(page.data)?.[1];
  assert.ok(firmHref, "ilan sayfasında firma bağlantısı olmalı");
  const firm = await client.get(firmHref);
  assert.equal(firm.status, 200);
  assert.match(firm.data, /Anı Fotoğraf/);
  assert.ok(firm.data.includes(listing.id), "firma sayfasında ilan listelenmeli");
  const renamed = await client.get(firmHref.replace(/\/firma\/.*-([a-f0-9]{12})$/, "/firma/eski-ad-$1"));
  assert.equal(renamed.status, 301);
  assert.equal(renamed.headers.get("location"), firmHref);
  assert.equal((await client.get("/firma/olmayan-firma-000000000000")).status, 404);

  const sitemap = await client.get("/sitemap.xml");
  assert.ok(sitemap.data.includes(firmHref));
  assert.ok(sitemap.data.includes(listing.id));

  const empty = await new Client(server.base).get("/favoriler");
  assert.equal(empty.status, 200);
  assert.ok(!empty.data.includes('class="card-listing'));
  const visitor = new Client(server.base);
  visitor.cookies.set("os_fav", `${listing.id}.gecersiz.0000000000`);
  const favorites = await visitor.get("/favoriler");
  assert.ok(favorites.data.includes('class="card-listing'));
  assert.equal(favorites.headers.get("cache-control"), "private, no-store");
});

test("hizmet ve il sayfaları: temiz adres, yönlendirme, site haritası", async () => {
  const redirect = await client.get("/ilanlar?q=&kategori=fotografci&il=%C4%B0stanbul&ilce=&min=&max=");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "/hizmet/fotografci/istanbul");

  const landing = await client.get("/hizmet/fotografci/istanbul");
  assert.equal(landing.status, 200);
  assert.ok(landing.data.includes(listing.id));
  assert.match(landing.data, /<title>İstanbul Etkinlik Fotoğrafçısı İlanları ve Fiyatları/);
  assert.match(landing.data, /rel="canonical" href="https:\/\/organizasyonsepeti\.net\/hizmet\/fotografci\/istanbul"/);

  assert.ok((await client.get("/il/istanbul")).data.includes(listing.id));
  assert.ok((await client.get("/etkinlik/kina")).data.includes(listing.id));
  assert.equal((await client.get("/hizmet/fotografci?sayfa=1")).status, 301);
  assert.equal((await client.get("/hizmet/olmayan-hizmet")).status, 404);
  assert.equal((await client.get("/hizmet/fotografci/atlantis")).status, 404);
  assert.equal(
    (await client.get("/ilanlar?kategori=fotografci&q=d%C3%BC%C4%9F%C3%BCn")).status,
    200,
    "serbest aramada yönlendirme yok",
  );

  const sitemap = (await client.get("/sitemap.xml")).data;
  for (const path of ["/hizmet/fotografci", "/hizmet/fotografci/istanbul", "/il/istanbul", "/etkinlik/kina"]) {
    assert.ok(sitemap.includes(`https://organizasyonsepeti.net${path}</loc>`), path);
  }
  assert.ok(!sitemap.includes("/hizmet/palyaco<"), "ilanı olmayan hizmet site haritasında yer almaz");
});

test("ilan görüntülenme sayacı botları saymaz", async () => {
  const view = (headers) => client.req("POST", "/api/v1/analytics/view", { listingId: listing.id }, headers);
  assert.equal((await view({ "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" })).status, 200);
  assert.equal((await view({ "User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile" })).status, 200);
  assert.equal((await client.req("POST", "/api/v1/analytics/view", { listingId: "0000000000" })).status, 404);
  const me = await organizer.get("/api/account/me");
  assert.equal(me.data.listings[0].stats.view, 1);
});

test("iletişim bariyeri: SMS doğrulamasından sonra telefon görünür", async () => {
  const gated = await client.get(`/api/v1/listings/${listing.id}/contact?type=phone`);
  assert.equal(gated.status, 403);
  assert.equal(gated.data.needsVerification, true);

  const user = await verifyPhone(client, CLIENT_MOBILE);
  assert.equal(user.role, "client");

  const contact = await client.get(`/api/v1/listings/${listing.id}/contact?type=phone`);
  assert.equal(contact.status, 200);
  assert.equal(contact.data.phone, "0532 111 22 33");
});

test("teklif talebi gönderilir, organizatör görür ve durumunu değiştirir", async () => {
  const anonymous = new Client(server.base);
  const blocked = await anonymous.post(`/api/v1/listings/${listing.id}/request`, {
    name: "Mehmet",
    phone: "05001112233",
    message: "Doğrulamasız talep denemesi yapıyorum.",
  });
  assert.equal(blocked.status, 403, "bariyer açıkken doğrulamasız talep reddedilmeli");

  const tooShort = await client.post(`/api/v1/listings/${listing.id}/request`, { name: "Mehmet", message: "kısa" });
  assert.equal(tooShort.status, 400);

  const eventDate = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  const sent = await client.post(`/api/v1/listings/${listing.id}/request`, {
    name: "Mehmet Kaya",
    eventDate,
    guests: "150",
    event: "kina",
    message: "Kadıköy'de akşam kına gecemiz var, fiyat alabilir miyim?",
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.data));
  assert.equal(sent.data.company, "Anı Fotoğraf");

  const again = await client.post(`/api/v1/listings/${listing.id}/request`, {
    name: "Mehmet Kaya",
    message: "Aynı gün ikinci kez talep gönderiyorum.",
  });
  assert.equal(again.status, 429, "aynı ilana günde bir talep");

  const me = await organizer.get("/api/account/me");
  assert.equal(me.data.newRequests, 1);
  assert.equal(me.data.listings[0].stats.request, 1);

  const { requests } = (await organizer.get("/api/account/requests")).data;
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.name, "Mehmet Kaya");
  assert.equal(request.phone, "0533 999 88 77");
  assert.equal(request.phoneVerified, true);
  assert.equal(request.guests, 150);
  assert.equal(request.eventDate, eventDate);

  // Başka bir üye bu talebe erişemez
  const stranger = await client.put(`/api/account/requests/${request.id}`, { status: "won" });
  assert.equal(stranger.status, 403);

  const updated = await organizer.put(`/api/account/requests/${request.id}`, { status: "contacted", note: "Arandı" });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.request.status, "contacted");
  assert.equal((await organizer.get("/api/account/me")).data.newRequests, 0);

  const mine = await client.get("/api/account/sent-requests");
  assert.equal(mine.data.requests.length, 1);
  assert.equal(mine.data.requests[0].seen, true);
  assert.equal(mine.data.requests[0].note, undefined, "organizatörün notu müşteriye gösterilmemeli");

  const own = await organizer.post(`/api/v1/listings/${listing.id}/request`, {
    name: "Ayşe",
    message: "Kendi ilanıma talep göndermeyi deniyorum.",
  });
  assert.equal(own.status, 400);
});

test("değerlendirme: yalnızca teklif isteyen müşteri yazar, yönetici onaylar, firma yanıtlar", async () => {
  const organizerId = (await organizer.get("/api/account/me")).data.user.id;
  const url = `/api/v1/firms/${organizerId}/reviews`;
  const review = { rating: 4, name: "Mehmet Kaya", comment: "Çok ilgili ve dakiklerdi, fotoğraflar harika çıktı." };

  const empty = await client.get(url);
  assert.equal(empty.status, 200);
  assert.equal(empty.data.summary, null);

  const anonymous = await new Client(server.base).post(url, review);
  assert.equal(anonymous.status, 403);
  assert.equal(anonymous.data.needsVerification, true);

  const stranger = new Client(server.base);
  await verifyPhone(stranger, "905350000001");
  assert.equal((await stranger.post(url, review)).status, 403, "teklif istememiş müşteri yorum yazamaz");

  assert.equal((await client.post(url, { ...review, rating: 9 })).status, 400);
  const created = await client.post(url, review);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal((await client.post(url, review)).status, 409, "aynı firmaya ikinci yorum yazılamaz");
  assert.equal((await client.get(url)).data.reviews.length, 0, "onaydan önce yayınlanmaz");

  const summary = await admin.get("/api/admin/summary");
  assert.equal(summary.data.pendingReviews, 1);
  const [pending] = (await admin.get("/api/admin/reviews")).data.reviews;
  assert.equal(pending.status, "pending");
  const published = await admin.req("PATCH", `/api/admin/reviews/${organizerId}/${pending.id}`, {
    status: "published",
  });
  assert.equal(published.status, 200);

  const visible = (await client.get(url)).data;
  assert.equal(visible.reviews.length, 1);
  assert.equal(visible.reviews[0].authorName, "Mehmet K.", "tam ad yayınlanmaz");
  assert.equal(visible.reviews[0].authorId, undefined);
  assert.deepEqual(visible.summary, { avg: 4, count: 1 });

  const firmHref = /href="(\/firma\/[^"#]+)/.exec((await client.get(`/ilan/${listing.slug}-${listing.id}`)).data)[1];
  const firm = (await client.get(firmHref)).data;
  assert.ok(firm.includes("Mehmet K."));
  assert.ok(firm.includes('"aggregateRating"'));
  assert.ok((await client.get("/hizmet/fotografci")).data.includes("rating-badge"), "ilan kartında yıldız görünür");

  assert.equal((await client.post(`/api/account/reviews/${pending.id}/reply`, { text: "Teşekkürler!" })).status, 403);
  const reply = await organizer.post(`/api/account/reviews/${pending.id}/reply`, { text: "Teşekkür ederiz!" });
  assert.equal(reply.status, 200);
  assert.equal((await client.get(url)).data.reviews[0].reply, "Teşekkür ederiz!");
});

test("şifremi unuttum: doğrulanmış telefona gelen kodla yeni şifre", async () => {
  await verifyPhone(organizer, ORGANIZER_MOBILE);
  const me = await organizer.get("/api/account/me");
  assert.equal(me.data.user.phoneVerified, true);
  assert.equal(me.data.user.role, "organizer");

  const visitor = new Client(server.base);
  const unknown = await visitor.post("/api/account/reset/start", { email: "yok@example.com" });
  assert.equal(unknown.status, 200, "kayıtlı olmayan e-postada da aynı yanıt dönmeli");

  const start = await visitor.post("/api/account/reset/start", { email: "AYSE@example.com" });
  assert.equal(start.status, 200);
  const code = await server.otp(ORGANIZER_MOBILE);

  const wrong = await visitor.post("/api/account/reset/finish", {
    email: "ayse@example.com",
    code: code === "000000" ? "111111" : "000000",
    password: "yeni-sifre-123",
  });
  assert.equal(wrong.status, 400);

  const done = await visitor.post("/api/account/reset/finish", {
    email: "ayse@example.com",
    code,
    password: "yeni-sifre-123",
  });
  assert.equal(done.status, 200, JSON.stringify(done.data));

  // Eski oturum geçersiz olur, yeni şifreyle giriş yapılır
  assert.equal((await organizer.get("/api/account/me")).status, 401);
  assert.equal(
    (await organizer.post("/api/account/login", { email: "ayse@example.com", password: "sifre12345" })).status,
    401,
  );
  const login = await organizer.post("/api/account/login", { email: "ayse@example.com", password: "yeni-sifre-123" });
  assert.equal(login.status, 200);
});

test("kara liste: iki farklı organizatörden ihbar alan numara engellenir", async () => {
  const second = new Client(server.base);
  const reg = await second.post("/api/account/register", {
    name: "Can Demir",
    company: "Demir Ses Işık",
    email: "can@example.com",
    phone: "0544 000 11 22",
    tcVkn: "9876543210",
    password: "sifre12345",
    acceptTerms: true,
  });
  assert.equal(reg.status, 201);

  const first = await organizer.post("/api/v1/reports/blacklist", { phone: "0533 999 88 77", reason: "kapida-iptal" });
  assert.equal(first.status, 201);
  assert.equal(first.data.blocked, false);
  const dup = await organizer.post("/api/v1/reports/blacklist", { phone: "0533 999 88 77", reason: "kapida-iptal" });
  assert.equal(dup.status, 409, "aynı organizatör ikinci kez ihbar edemez");
  const secondReport = await second.post("/api/v1/reports/blacklist", { phone: "05339998877", reason: "sahte-adres" });
  assert.equal(secondReport.data.blocked, true);

  const otp = await new Client(server.base).post("/api/v1/auth/send-otp", { phone: "0533 999 88 77" });
  assert.equal(otp.status, 403);
  const contact = await client.get(`/api/v1/listings/${listing.id}/contact?type=phone`);
  assert.equal(contact.status, 403);
});

test("hesap silinince teklif talepleri de silinir", async () => {
  const removed = await client.del("/api/account", {});
  assert.equal(removed.status, 200);
  const { requests } = (await organizer.get("/api/account/requests")).data;
  assert.equal(requests.length, 0);
  const organizerId = (await organizer.get("/api/account/me")).data.user.id;
  const reviews = (await organizer.get(`/api/v1/firms/${organizerId}/reviews`)).data;
  assert.equal(reviews.reviews.length, 0, "silinen üyenin yorumu da silinir");
  assert.equal(reviews.summary, null);
});
