// Tüm sayfaların ortak parçaları: <head>, üst menü, alt bilgi ve yardımcılar.
import { icon } from "../../../public/assets/js/icons.js";
import { dopingActive, formatPrice, listingPath } from "../listings.mjs";
import { searchPath } from "./urls.mjs";

// CSS/JS değiştiğinde tarayıcı önbelleğini kırmak için artırın.
export const ASSET_VERSION = "8";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
export { icon };

export const paragraphs = (text) =>
  String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

// Yasal metinler için basit biçim: boş satır paragraf, "## " başlık, "- " madde.
export function richText(text, vars) {
  const filled = String(text || "").replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
  return filled
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("## ")) return `<h2>${esc(block.slice(3))}</h2>`;
      const lines = block.split("\n");
      if (lines.every((l) => l.trim().startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${esc(l.trim().slice(2))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(esc).join("<br>")}</p>`;
    })
    .join("");
}

// Panelden girilen bağlantılar yalnızca güvenli şemalarla sayfaya yazılır.
export function safeUrl(url) {
  const value = String(url || "").trim();
  if (/^(https?:|mailto:|tel:)/i.test(value) || /^\/(?!\/)/.test(value)) return value;
  return "";
}

// Yüklenen görseller Netlify Image CDN ile istenen boyutta ve uygun biçimde (WebP/AVIF) sunulur.
export function imageUrl(url, width, height) {
  const src = safeUrl(url);
  if (!src.startsWith("/media/")) return src;
  const size = `&w=${width}${height ? `&h=${height}&fit=cover` : ""}`;
  return `/.netlify/images?url=${encodeURIComponent(src)}${size}&q=78`;
}

export const absoluteUrl = (c, path) => new URL(path, `${c.settings.siteUrl.replace(/\/$/, "")}/`).href;

export function socialUrl(value, base) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `${base}${v.replace(/^@/, "")}`;
}

export function socials(settings) {
  return [
    { name: "instagram", label: "Instagram", url: socialUrl(settings.instagram, "https://instagram.com/") },
    { name: "tiktok", label: "TikTok", url: socialUrl(settings.tiktok, "https://www.tiktok.com/@") },
    { name: "facebook", label: "Facebook", url: socialUrl(settings.facebook, "https://facebook.com/") },
  ].filter((s) => s.url);
}

export const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;

export function whatsappHref(settings, text) {
  if (!settings.whatsapp) return "";
  const message = text ?? settings.whatsappMessage;
  return `https://wa.me/${settings.whatsapp}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

// Logodaki sepet ve balonlar (logo görselinden arka planı ayıklanarak kesildi)
export const logoMark = () =>
  `<img class="logo-mark" src="/assets/img/logo-mark.webp" width="68" height="44" alt="" decoding="async">`;

// Site adının son kelimesi logodaki gibi mercan rengi: "Organizasyon <em>Sepeti</em>"
export function logoText(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/);
  const last = words.length > 1 ? words.pop() : "";
  return `<span class="logo-text">${esc(words.join(" "))}${last ? ` <em>${esc(last)}</em>` : ""}</span>`;
}

export function sectionHead(section, { align = "center", link } = {}) {
  return `<header class="section-head${align === "left" ? " is-left" : ""}">
    <div>
      ${section.eyebrow ? `<p class="eyebrow">${esc(section.eyebrow)}</p>` : ""}
      <h2>${esc(section.title)}</h2>
      ${section.text ? `<p class="section-lead">${esc(section.text)}</p>` : ""}
    </div>
    ${link ? `<a class="text-link" href="${esc(link.href)}">${esc(link.label)}${icon("arrow")}</a>` : ""}
  </header>`;
}

export const categoryMap = (c) => new Map(c.categories.map((cat) => [cat.id, cat]));

export const priceHtml = (x) =>
  x.priceMin
    ? `<span class="price">${formatPrice(x.priceMin)}${x.priceNote ? ` <small>${esc(x.priceNote)}</small>` : ""}</span>`
    : `<span class="price is-ask">Fiyat sorunuz</span>`;

export const locationText = (x) => (x.district ? `${x.city} / ${x.district}` : `${x.city} (il geneli)`);

// Yıldız puanı: 4.8 -> "4,8" ve 5 yıldızlık gösterim
export const fmtRating = (avg) =>
  Number(avg).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function stars(rating, cls = "stars") {
  const full = Math.round(rating);
  return `<span class="${cls}" role="img" aria-label="5 üzerinden ${fmtRating(rating)} puan">${[1, 2, 3, 4, 5]
    .map((n) => `<span class="${n <= full ? "is-on" : ""}">${icon("star")}</span>`)
    .join("")}</span>`;
}
// x.rating: { avg, count } (firma değerlendirmeleri, bkz. lib/reviews.mjs)
export const ratingBadge = (rating) =>
  rating?.count
    ? `<span class="rating-badge">${icon("star")}<strong>${fmtRating(rating.avg)}</strong><span>(${rating.count})</span></span>`
    : "";

// Favori butonu: durum tarayıcıda (os_fav çerezi) tutulur, site.js işaretler.
export const favButton = (id, { label = false } = {}) =>
  `<button type="button" class="fav-btn${label ? " has-label" : ""}" data-fav="${esc(id)}" aria-pressed="false" aria-label="Favorilere ekle">${icon("heart")}${label ? "<span>Favorilere ekle</span>" : ""}</button>`;

// İlan kartı (liste, ana sayfa ve benzer ilanlar)
export function listingCard(x, cats, { eager = false, showcase = false } = {}) {
  const cat = cats.get(x.category);
  const highlight = dopingActive(x, "highlight");
  const href = listingPath(x);
  const image = x.image
    ? `<img src="${esc(imageUrl(x.image, 640, 480))}" alt="${esc(x.title)}" width="640" height="480" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>`
    : `<span class="cl-placeholder">${icon(cat?.icon || "balloon")}</span>`;
  return `<article class="card-listing${highlight ? " is-highlight" : ""}">
    ${favButton(x.id)}
    <a class="cl-media" href="${esc(href)}" tabindex="-1" aria-hidden="true">
      ${image}
      ${showcase ? `<span class="badge badge-featured">${icon("star")}Vitrin</span>` : highlight ? `<span class="badge badge-highlight">${icon("badge")}Öne Çıkan</span>` : ""}
      ${x.imageCount > 1 ? `<span class="cl-count">${icon("image")}${x.imageCount}</span>` : ""}
    </a>
    <div class="cl-body">
      <p class="cl-cat">${esc(cat?.name || "Organizasyon")}</p>
      <h3><a href="${esc(href)}">${esc(x.title)}</a></h3>
      <p class="cl-loc">${icon("pin")}${esc(locationText(x))}${ratingBadge(x.rating)}</p>
      <div class="cl-foot">
        ${priceHtml(x)}
        <span class="cl-company">${esc(x.company)}</span>
      </div>
    </div>
  </article>`;
}

function structuredData(c) {
  const s = c.settings;
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: s.siteName,
    url: absoluteUrl(c, "/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl(c, "/ilanlar")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return data;
}

// "<" kaçışı, verinin script etiketini kapatmasını engeller.
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

function siteHeader(c, { home }) {
  const s = c.settings;
  return `<a class="skip-link" href="#icerik">İçeriğe geç</a>
<header class="site-header${home ? "" : " is-solid"}">
  <div class="container header-inner">
    <a class="logo" href="/" aria-label="${esc(s.siteName)} ana sayfa">${logoMark()}${logoText(s.siteName)}</a>
    <nav class="main-nav" id="menu" aria-label="Ana menü">
      <a href="/ilanlar">İlanlar</a>
      <a href="/#hizmetler">Hizmetler</a>
      <a href="/#nasil-calisir">Nasıl çalışır?</a>
      <a href="/iletisim">İletişim</a>
      <a class="nav-fav" href="/favoriler" aria-label="Favorilerim">${icon("heart")}<span class="nav-fav-label">Favorilerim</span><b data-fav-count hidden></b></a>
      <a class="nav-account" href="/hesap/" data-account-link>${icon("user")}<span>Giriş yap</span></a>
      <a class="btn btn-action btn-sm nav-cta" href="/hesap/#yeni-ilan">${icon("plus")}İlan Ver</a>
    </nav>
    <button class="menu-toggle" type="button" aria-controls="menu" aria-expanded="false" aria-label="Menüyü aç">${icon("menu")}${icon("close")}</button>
  </div>
</header>`;
}

function siteFooter(c) {
  const s = c.settings;
  const social = socials(s);
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="logo" href="/">${logoMark()}${logoText(s.siteName)}</a>
        ${s.tagline ? `<p>${esc(s.tagline)}</p>` : ""}
        ${social.length ? `<div class="social">${social.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${x.label}">${icon(x.name)}</a>`).join("")}</div>` : ""}
      </div>
      <nav class="footer-col" aria-label="Hizmetler">
        <h4>Hizmetler</h4>
        ${c.categories
          .slice(0, 7)
          .map((cat) => `<a href="${esc(searchPath({ kategori: cat.slug }))}">${esc(cat.name)}</a>`)
          .join("")}
      </nav>
      <nav class="footer-col" aria-label="Site">
        <h4>Site</h4>
        <a href="/ilanlar">Tüm ilanlar</a>
        <a href="/hesap/#yeni-ilan">İlan ver</a>
        <a href="/hesap/">Organizatör girişi</a>
        <a href="/favoriler">Favorilerim</a>
        ${s.playStoreUrl ? `<a class="play-link" href="${esc(safeUrl(s.playStoreUrl))}" target="_blank" rel="noopener">${icon("phone")}Android uygulaması</a>` : ""}
        <a href="/iletisim">İletişim</a>
      </nav>
      <nav class="footer-col" aria-label="Yasal">
        <h4>Yasal</h4>
        <a href="/kullanim-kosullari">Kullanım koşulları</a>
        <a href="/kvkk">KVKK aydınlatma metni</a>
        ${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ""}
        ${s.phone ? `<a href="${esc(telHref(s.phone))}">${esc(s.phone)}</a>` : ""}
      </nav>
    </div>
    <div class="container footer-bottom">
      <p>© ${new Date().getFullYear()} ${esc(s.siteName)}. Tüm hakları saklıdır.</p>
      <p>${esc(s.siteName)} komisyon almaz; hizmetler ilan veren organizatörler tarafından sunulur.</p>
    </div>
  </footer>`;
}

export function layout(c, { title, description, path, ogImage, body, home = false, ld = [], noindex = false }) {
  const s = c.settings;
  const url = absoluteUrl(c, path);
  const image = absoluteUrl(
    c,
    imageUrl(safeUrl(ogImage) || safeUrl(s.ogImage) || "/assets/img/og-default.jpg", 1200, 630),
  );
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`}
<meta property="og:type" content="website">
<meta property="og:locale" content="tr_TR">
<meta property="og:site_name" content="${esc(s.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#6c5ce7">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=${ASSET_VERSION}">
${[structuredData(c), ...ld].map(jsonLd).join("\n")}
<script type="module" src="/assets/js/site.js?v=${ASSET_VERSION}"></script>
</head>
<body>
${siteHeader(c, { home })}
<main id="icerik">
${body}
</main>
${siteFooter(c)}
<div class="lightbox" hidden>
  <button type="button" class="lightbox-close" aria-label="Kapat">${icon("close")}</button>
  <button type="button" class="lightbox-prev" aria-label="Önceki">${icon("chevron")}</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button type="button" class="lightbox-next" aria-label="Sonraki">${icon("chevron")}</button>
</div>
</body>
</html>`;
}

// İletişim bariyeri: telefon numarası SMS koduyla doğrulanınca iletişim bilgileri açılır.
export function otpDialog() {
  return `<dialog class="dialog" id="dogrulama">
    <form class="dialog-form" data-otp-form novalidate>
      <header class="dialog-head">
        <h2>Telefonunuzu doğrulayın</h2>
        <button type="button" class="icon-btn" data-close-dialog aria-label="Kapat">${icon("close")}</button>
      </header>
      <p class="dialog-lead">Sahte arama, talep ve yorumları engellemek için numaranızı SMS koduyla doğrulamanızı istiyoruz. Bu işlem bir kez yapılır.</p>
      <label class="field" data-step="phone"><span>Cep telefonunuz</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx" required></label>
      <label class="field" data-step="code" hidden><span>SMS ile gelen 6 haneli kod</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></label>
      <p class="form-status" role="status" aria-live="polite"></p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-close-dialog>Vazgeç</button>
        <button type="submit" class="btn btn-primary" data-otp-submit>Kod gönder</button>
      </div>
      <p class="form-note">Numaranız organizatörlerle paylaşılmaz. <a href="/kvkk" target="_blank">KVKK Aydınlatma Metni</a></p>
    </form>
  </dialog>`;
}

// Sayfa üstü: içerik sayfalarında başlık bandı
export function pageHero({ eyebrow, title, text, crumbs = [] }) {
  return `<section class="page-hero">
    <div class="container">
      ${
        crumbs.length
          ? `<nav class="crumbs" aria-label="Konum">${crumbs
              .map(([label, href]) =>
                href ? `<a href="${esc(href)}">${esc(label)}</a>` : `<span>${esc(label)}</span>`,
              )
              .join(`<span class="crumb-sep">${icon("chevron")}</span>`)}</nav>`
          : ""
      }
      ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
      <h1>${esc(title)}</h1>
      ${text ? `<p class="page-lead">${text}</p>` : ""}
    </div>
  </section>`;
}
