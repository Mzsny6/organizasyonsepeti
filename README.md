# Organizasyon Sepeti

[organizasyonsepeti.net](https://organizasyonsepeti.net): organizatörler (düğün salonu, catering, fotoğrafçı, bando, palyaço, ses-ışık…) ile etkinlik sahiplerini buluşturan, "sahibinden" modelinde dikey pazar yeri. Komisyon yoktur; ziyaretçiler organizatörlere doğrudan telefon/WhatsApp ile ulaşır. Gelir modeli kademeli ilan paketleri ve dopinglerdir (PRD v3.0).

Site **Netlify** üzerinde çalışır: sayfalar ve API'ler Netlify Functions (Node.js), veriler ve fotoğraflar Netlify Blobs'ta tutulur. Ayrı sunucu ya da veritabanı gerekmez.

## Özellikler

**Ziyaretçi**

- Hizmet türü (kademeli kategoriler), etkinlik türü, il/ilçe (81 il, 973 ilçe), bütçe ve kelimeyle arama; sıralama ve sayfalama.
- İlan sayfası: fotoğraf galerisi, fiyat, organizatör bilgisi ("Onaylı hesap" rozeti), müsaitlik takvimi, benzer ilanlar, şikâyet.
- **İletişim bariyeri:** "Hemen Ara" ve WhatsApp butonları, telefon numarası SMS koduyla doğrulandıktan sonra çalışır.
- **Teklif İste:** tarih, kişi sayısı, etkinlik türü ve ayrıntılarla organizatöre talep gönderme (SMS doğrulamalı).
- **Firma sayfası** (`/firma/...`): organizatörün yayındaki tüm ilanları.
- **Favoriler** (`/favoriler`): kalp simgesiyle ilan kaydetme (üyelik gerekmez, tarayıcıda saklanır).
- **Değerlendirmeler:** firmaya site üzerinden teklif isteyen, telefonu doğrulanmış müşteriler 1-5 yıldız ve yorum yazar; yönetici onayından sonra firma sayfasında yayınlanır, ilan kartlarında yıldız ortalaması görünür.
- **Arama motoru sayfaları:** `/hizmet/dugun-salonu`, `/hizmet/dugun-salonu/istanbul`, `/il/istanbul`, `/etkinlik/kina` gibi temiz adresler; altında ilgili il ve hizmet bağlantıları.
- Ana sayfa vitrini, renkli çerçeve/rozetli ilanlar, kategoride üst sıra (dopingler).

**Organizatör (`/hesap`)**

- Üyelik (T.C. kimlik/vergi no ile), fotoğraflı ilan verme ve düzenleme.
- Hizmet kademesine göre 1/3/12 aylık ilan paketleri, **promosyon kodu** (ör. `MAYA3AY`), doping satın alma.
- Ödemeler: kartla ödeme bağlanana kadar havale/EFT; sipariş numarası ve IBAN gösterilir.
- **Randevu takvimi (CRM):** iş kayıtları, kapora/toplam tutar, çifte rezervasyon uyarısı, ilanda dolu günleri gösterme.
- **Teklif talepleri:** gelen talepler, durum takibi (Yeni / Görüşüldü / Anlaşıldı / Olmadı), özel not, tek tıkla arama/WhatsApp, "Takvime ekle".
- **Kara liste:** asılsız adres veren / kapıda iptal eden müşteriyi bildirme. Farklı organizatörlerden 2 ihbar alan numara kalıcı engellenir.
- Telefon, WhatsApp ve teklif talebi istatistikleri.
- **Şifremi unuttum:** profilde doğrulanan telefona gelen SMS koduyla yeni şifre.
- **Yorumlar:** firmaya yazılan değerlendirmeleri görme ve yanıtlama.

**Yönetim paneli (`/admin`)**

- **Ziyaret istatistikleri:** tekil ziyaretçi, sayfa görüntüleme, günlük grafik, saat dağılımı, en çok bakılan sayfalar, trafik kaynakları (Google, Instagram, WhatsApp…), şehirler, cihaz/tarayıcı, sitede aranan kelimeler ve ziyaretçilerin firmalara ulaşma sayıları (telefon, WhatsApp, teklif talebi). Çerez kullanılmaz, IP saklanmaz; yönetici kendi cihazındaki ziyaretleri saydırmayabilir. Paylaşılan bağlantılara `?utm_source=instagram` gibi bir ek konursa kaynak ayrı görünür.

- İlan onay kuyruğu (ödemesi onaylanmamış ilan yayına alınamaz), reddetme, süre ekleme, doping tanımlama.
- Havale ödemelerini onaylama, promosyon kodları (indirim %, paket, kullanım limiti, son tarih).
- Üyeler (engelleme, geçici şifre), kara liste, şikâyetler, değerlendirme onayı, iletişim mesajları.
- Kategoriler ve kademeleri, etkinlik türleri, ana sayfa metinleri, SSS, fiyatlar, IBAN, güvenlik ayarları (teklif talebinde organizatöre SMS bildirimi dahil), SEO, KVKK ve kullanım koşulları.
- "Ücretsiz mod": lansman döneminde tüm paketleri ücretsiz yapar.

## Yayına alma (Netlify)

### 1. Projeyi bağlayın

1. [app.netlify.com](https://app.netlify.com) → **Add new project → Import an existing project → GitHub** → bu depo.
2. Ayarlar `netlify.toml`'dan okunur (build komutu yok, yayın klasörü `public`). **Deploy**.

### 2. Ortam değişkenleri

**Project configuration → Environment variables**:

| Değişken          | Zorunlu  | Açıklama                                                          |
| ----------------- | -------- | ----------------------------------------------------------------- |
| `ADMIN_PASSWORD`  | Evet     | Yönetim paneli şifresi                                            |
| `SMS_PROVIDER`    | SMS için | `netgsm`                                                          |
| `NETGSM_USERCODE` | SMS için | Netgsm kullanıcı kodu                                             |
| `NETGSM_PASSWORD` | SMS için | Netgsm API şifresi                                                |
| `NETGSM_HEADER`   | SMS için | Onaylı SMS başlığı (gönderici adı)                                |
| `SMS_TEST_MODE`   | Hayır    | `1` → SMS gönderilmez, kod sunucu kaydına yazılır (yalnızca test) |
| `SMS_DAILY_LIMIT` | Hayır    | Site geneli günlük en fazla SMS (varsayılan 500; kredi güvenliği) |

Değişkenleri ekledikten sonra **Deploys → Trigger deploy**.

> SMS sağlayıcısı bağlanana kadar iletişim bariyeri otomatik kapalıdır; telefon numaraları doğrulamasız görünür. Netgsm'in SMS gönderim adresi ve yanıt kodlarını hesabınızı açınca dokümanlarından doğrulayın (`netlify/lib/sms.mjs`).

> **Şifreyi unutursanız:** `ADMIN_PASSWORD`'ü yeni bir değere ayarlayıp yeniden yayınlayın.

### 3. Alan adı (Netlify DNS)

1. **Domain management → Add a domain** → `organizasyonsepeti.net` → **Set up Netlify DNS**.
2. Netlify'ın verdiği 4 nameserver'ı alan adını aldığınız firmanın panelinde **DNS sunucuları** bölümüne girin.
3. Yayılma birkaç saat (en fazla 48 saat) sürebilir; SSL sertifikası otomatik kurulur.

### 4. İlk ayarlar (`/admin`)

- **Fiyatlandırma:** IBAN ve banka bilgileri (ya da "Ücretsiz mod").
- **Promosyon kodları:** ör. `MAYA3AY` · %100 · 3 Aylık · 100 kullanım.
- **İletişim bilgileri** ve sosyal medya.
- **Yasal metinler:** KVKK ve kullanım koşullarını bir hukukçuya kontrol ettirin.

## Android uygulaması (Google Play)

Uygulama, sitenin kendisini tam ekran açan bir **Trusted Web Activity (TWA)** paketidir: ayrı bir kod tabanı yoktur, sitede yapılan her değişiklik uygulamada da anında görünür. Site bunun için hazırdır (uygulama simgeleri, kısayollar, çevrimdışı ekranı, doğrulama dosyası).

1. Site `https://organizasyonsepeti.net` adresinde yayında olmalı.
2. [pwabuilder.com](https://www.pwabuilder.com) → site adresini yazın → **Package for stores → Android**.
   - **Package ID:** `net.organizasyonsepeti.twa` · **App name:** Organizasyon Sepeti · **Launcher name:** Org. Sepeti
   - **Signing key:** _Create new_ → **Download**. İndirilen klasördeki imza anahtarını (`.keystore`) ve şifrelerini güvenli bir yerde saklayın; uygulama güncellemeleri için gerekir.
3. [Google Play Console](https://play.google.com/console) hesabı açın (tek seferlik 25 $) → **Uygulama oluştur** → paketteki `.aab` dosyasını önce **Dahili test**, sonra **Üretim** sürümüne yükleyin. Gizlilik politikası adresi: `https://organizasyonsepeti.net/kvkk`.
4. Play Console → **Uygulama bütünlüğü → Uygulama imzalama** bölümündeki **SHA-256 sertifika parmak izini** kopyalayın.
5. `/admin` → **Marka & SEO → Android uygulaması**: paket adını ve parmak izini yapıştırın, kaydedin. `https://organizasyonsepeti.net/.well-known/assetlinks.json` adresinde görünür; bu sayede uygulamada adres çubuğu çıkmaz.
6. Uygulama yayınlanınca Google Play bağlantısını aynı yere girin; sitenin alt kısmında "Android uygulaması" bağlantısı görünür.

> Bildirim (push) gibi sitenin sağlayamadığı yerel özellikler gerekirse ileride aynı API (`/api/v1`) ile Flutter veya React Native uygulamasına geçilebilir.

## REST API (web ve Android uygulaması için)

| Uç nokta                                                                 | Açıklama                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------ |
| `POST /api/v1/auth/send-otp` `{phone}`                                   | SMS doğrulama kodu gönderir                            |
| `POST /api/v1/auth/verify-otp` `{phone, code}`                           | Kodu doğrular, oturum açar                             |
| `GET /api/v1/auth/status`                                                | Doğrulama durumu ve iletişim bariyeri                  |
| `GET /api/v1/meta`                                                       | Kategoriler, etkinlikler, iller, fiyatlar              |
| `GET /api/v1/listings?kategori&etkinlik&il&ilce&min&max&q&sirala&sayfa`  | Kategori, il, bütçe ve doping sıralamasıyla ilanlar    |
| `GET /api/v1/listings/:id`                                               | İlan detayı (telefon hariç)                            |
| `GET /api/v1/listings/:id/contact?type=phone\|whatsapp`                  | İletişim bilgisi + tıklama sayacı                      |
| `POST /api/v1/listings/:id/report`                                       | İlan şikâyeti                                          |
| `POST /api/v1/listings/:id/request` `{name, eventDate, guests, message}` | Teklif talebi (doğrulanmış numarayla)                  |
| `GET /api/v1/firms/:id/reviews`                                          | Firmanın yayındaki değerlendirmeleri ve ortalaması     |
| `POST /api/v1/firms/:id/reviews` `{rating, comment, name}`               | Değerlendirme (firmaya teklif istemiş müşteri)         |
| `POST /api/v1/promotions/apply` `{code, package, category}`              | İndirim kodunu doğrular, fiyatı hesaplar               |
| `POST /api/v1/analytics/click` `{listingId, type}`                       | İletişim butonu tıklaması                              |
| `GET /api/v1/organizer/calendar?listing=:id`                             | İlandaki dolu günler (oturumla: organizatörün takvimi) |
| `POST /api/v1/reports/blacklist` `{phone, reason, note}`                 | Kötü niyetli müşteri ihbarı (organizatör)              |

Organizatör işlemleri `/api/account/*`, yönetim işlemleri `/api/admin/*` altındadır.

## PRD'ye göre durum

| PRD maddesi                          | Durum                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Marka renkleri ve modern arayüz      | Tamam                                                                       |
| Promosyon kodu modülü                | Tamam                                                                       |
| Kademeli ilan paketleri ve dopingler | Tamam. Ödeme şimdilik havale/EFT + panel onayı                              |
| SMS OTP iletişim bariyeri            | Tamam. Netgsm hesabı ve ortam değişkenleri gerekli                          |
| Kara liste (2 ihbar → kalıcı engel)  | Tamam                                                                       |
| Organizatör randevu takvimi (CRM)    | Tamam                                                                       |
| REST API v1                          | Tamam                                                                       |
| Kartla ödeme (iyzico / PayTR)        | Bekliyor: şirket ve sanal POS başvurusu gerekli                             |
| Android uygulaması                   | Hazır: Google Play'e TWA paketi olarak yüklenir (bkz. "Android uygulaması") |

## Yerelde çalıştırma

Node.js 20+:

```bash
npm install
ADMIN_PASSWORD=deneme123 SMS_TEST_MODE=1 npm run dev:local   # http://localhost:8888, /hesap, /admin
```

`dev:local` Netlify hesabı istemez; veriler `.netlify/local-blobs` klasörüne yazılır. Test modunda SMS kodları terminale yazılır.

### Testler

```bash
npm test
```

Uçtan uca testler yerel sunucuyu geçici bir veri klasörüyle başlatır ve kayıt → promosyonlu paket → onay → arama ve hizmet sayfaları → SMS doğrulama → iletişim → teklif talebi → değerlendirme → şifre sıfırlama → kara liste akışlarını dener. GitHub'a her gönderimde aynı testler GitHub Actions'ta çalışır.

## Proje yapısı

```
public/                      Statik dosyalar
  admin/                     Yönetim paneli
  hesap/                     Organizatör hesabı
  assets/js/                 site.js, ui.js (ortak arayüz), icons.js, locations.js (il/ilçe)
netlify/functions/
  page.mjs                   Sayfalar: /, /ilanlar, /hizmet/..., /il/..., /etkinlik/..., /ilan/:slug, /firma/:slug,
                             /favoriler, /iletisim, /kvkk, /kullanim-kosullari
  api-v1.mjs                 PRD REST uç noktaları
  api-account.mjs            Üyelik, şifre sıfırlama, ilanlar, siparişler, teklif talepleri, takvim, kara liste
  api-admin.mjs              Moderasyon, ödemeler, promosyonlar, üyeler, kara liste, şikâyetler
  api-auth.mjs               Panel girişi
  api-content.mjs            Site içeriği ve yedekler
  api-media.mjs / media.mjs  Fotoğraf yükleme ve sunma
  api-messages.mjs           İletişim formu
  sitemap.mjs, daily.mjs     Site haritası; günlük önbellek ve eski talep temizliği
netlify/lib/                 Veri katmanı (listings, users, orders, promos, requests, reviews, bookings, blacklist, sms…)
netlify/lib/render/          Sunucu tarafı HTML şablonları
scripts/dev-server.mjs       Netlify'sız yerel sunucu
tests/                       Birim ve uçtan uca API testleri (npm test)
```
