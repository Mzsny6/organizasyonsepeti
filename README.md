# Organizasyon Sepeti

[organizasyonsepeti.net](https://organizasyonsepeti.net) için hazırlanan web sitesi ve yönetim paneli. Doğum günü, nişan, kına, baby shower ve benzeri organizasyonlar için tek sayfalık, mobil uyumlu bir site.

Site **Netlify** üzerinde çalışır. Ayrı bir sunucuya, veritabanına ya da aylık ücretli bir servise gerek yoktur; içerik, görseller ve form mesajları Netlify Blobs'ta saklanır.

## Neler var?

**Site**

- Karşılama alanı, hizmetler, çalışma adımları, paketler, galeri (kategori filtresi ve büyütme), hakkımızda, yorumlar, SSS ve teklif formu.
- WhatsApp butonu: formdaki bilgileri hazır mesaj olarak WhatsApp'a aktarır.
- 4 renk teması (gül kurusu, şampanya, lavanta, adaçayı).
- Sayfa sunucuda oluşturulur, bu yüzden Google içeriği eksiksiz görür. Başlık, açıklama, paylaşım görseli ve işletme bilgileri (schema.org) panelden yönetilir.

**Yönetim paneli (`/admin`)**

- Sitedeki tüm yazılar, hizmetler, paketler, SSS ve yorumlar düzenlenebilir, sıraları değiştirilebilir.
- Fotoğraf yükleme: telefondan çekilen büyük fotoğraflar yüklenmeden önce otomatik küçültülür.
- Teklif formundan gelen mesajlar listelenir; tek tıkla WhatsApp'tan yanıtlanır ya da aranır.
- Her kayıtta önceki hâl yedeklenir (son 20 kayıt), istenirse geri yüklenir.
- Şifre panelden değiştirilebilir. Hatalı denemeler 15 dakika kilitlenir.

## Yayına alma (Netlify)

### 1. Projeyi Netlify'a bağlayın

1. [app.netlify.com](https://app.netlify.com) adresinde GitHub hesabınızla oturum açın.
2. **Add new project → Import an existing project → GitHub** adımlarından bu depoyu seçin.
3. Ayarlar `netlify.toml` dosyasından otomatik okunur (build komutu yok, yayın klasörü `public`). **Deploy** deyin.

### 2. Yönetici şifresini tanımlayın

1. **Project configuration → Environment variables → Add a variable**
2. Anahtar: `ADMIN_PASSWORD`, değer: güçlü bir şifre.
3. **Deploys → Trigger deploy → Deploy project** ile yeniden yayınlayın.

Panel adresi: `https://organizasyonsepeti.net/admin`

> **Şifreyi unutursanız:** Netlify'da `ADMIN_PASSWORD` değerini yeni bir şifreyle değiştirip yeniden yayınlayın. Panelden önceden belirlenmiş şifre geçersiz olur, yeni şifreyle girersiniz.

### 3. Alan adını bağlayın (Netlify DNS)

1. Netlify'da **Domain management → Add a domain** bölümüne `organizasyonsepeti.net` yazın.
2. **Set up Netlify DNS** seçeneğini izleyin. Sonunda Netlify size 4 adet nameserver verir (`dns1.p0X.nsone.net` gibi).
3. Alan adını satın aldığınız firmanın panelinde (GoDaddy, Natro, İsimtescil vb.) **nameserver / DNS sunucuları** bölümüne bu 4 adresi girin.
4. Değişikliğin yayılması birkaç saat (en fazla 48 saat) sürebilir. Sonrasında Netlify ücretsiz SSL sertifikasını (https) kendisi kurar.

> E-posta (ör. info@organizasyonsepeti.net) kullanacaksanız MX kayıtlarını da Netlify DNS'e eklemeniz gerekir.

## Yerelde çalıştırma

Node.js 20+ gerekir.

```bash
npm install
ADMIN_PASSWORD=deneme123 npm run dev:local   # http://localhost:8888  ve  /admin
```

`dev:local` Netlify hesabı istemez; veriler `.netlify/local-blobs` klasörüne yazılır. Netlify CLI kuruluysa `npm run dev` (`netlify dev`) da kullanılabilir.

## Proje yapısı

```
public/                 Statik dosyalar (CSS, JS, favicon, panel arayüzü)
  admin/                Yönetim paneli (index.html, admin.js, admin.css)
  assets/               Sitenin stil ve betikleri
netlify/functions/      Sunucu fonksiyonları
  page.mjs              Ana sayfayı içerikten oluşturur ("/")
  api-content.mjs       İçerik okuma/kaydetme, yedekler
  api-auth.mjs          Giriş, çıkış, şifre değiştirme
  api-messages.mjs      Teklif formu ve mesaj yönetimi
  api-media.mjs         Görsel yükleme/silme
  media.mjs             Yüklenen görselleri sunar ("/media/...")
netlify/lib/            Ortak kod (varsayılan içerik, HTML şablonu, oturum)
scripts/dev-server.mjs  Netlify'sız yerel geliştirme sunucusu
```

Sitenin varsayılan metinleri `netlify/lib/defaults.mjs` dosyasındadır. Panelden kaydedilen içerik bunların yerine geçer.
