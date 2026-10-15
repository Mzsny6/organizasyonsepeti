import { icon } from "../../public/assets/js/icons.js";

// CSS/JS değiştiğinde tarayıcı önbelleğini kırmak için artırın.
export const ASSET_VERSION = "1";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const paragraphs = (text) =>
  String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

// Panelden girilen bağlantılar yalnızca güvenli şemalarla sayfaya yazılır.
function safeUrl(url) {
  const value = String(url || "").trim();
  if (/^(https?:|mailto:|tel:)/i.test(value) || /^\/(?!\/)/.test(value)) return value;
  return "";
}

function socialUrl(value, base) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `${base}${v.replace(/^@/, "")}`;
}

const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;

export function whatsappHref(settings, text) {
  if (!settings.whatsapp) return "";
  const message = text ?? settings.whatsappMessage;
  return `https://wa.me/${settings.whatsapp}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

function socials(settings) {
  return [
    { name: "instagram", label: "Instagram", url: socialUrl(settings.instagram, "https://instagram.com/") },
    { name: "tiktok", label: "TikTok", url: socialUrl(settings.tiktok, "https://www.tiktok.com/@") },
    { name: "facebook", label: "Facebook", url: socialUrl(settings.facebook, "https://facebook.com/") },
  ].filter((s) => s.url);
}

const logoMark = () => `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true">
  <path d="M14 16.5 18 25M24 15.5 21 25M30.5 20 25 25" stroke="currentColor" stroke-width="1" fill="none"/>
  <circle cx="14" cy="11" r="6" style="fill:var(--b1)"/><circle cx="24" cy="8.5" r="7" style="fill:var(--accent)"/><circle cx="30.5" cy="16" r="4.6" style="fill:var(--b3)"/>
  <path d="M7.5 24.5h25l-3 10.6a2 2 0 0 1-1.9 1.4H12.4a2 2 0 0 1-1.9-1.4L7.5 24.5Z" fill="currentColor"/>
  <path class="logo-weave" d="M10 28.5h20M11.2 32.5h17.6M15 25v11M20 25v11M25 25v11" stroke-width=".9" fill="none"/>
</svg>`;

function sectionHead(section, align = "center") {
  return `<header class="section-head ${align === "left" ? "is-left" : ""} reveal">
    ${section.eyebrow ? `<p class="eyebrow">${esc(section.eyebrow)}</p>` : ""}
    <h2>${esc(section.title)}</h2>
    ${section.text ? `<p class="section-lead">${esc(section.text)}</p>` : ""}
  </header>`;
}

// Görsel yüklenmemişken kemerin içinde görünen balon çizimi.
const BALLOONS = [
  [70, 470, 30, 1],
  [52, 420, 26, 2],
  [82, 392, 34, 3],
  [58, 340, 30, 1],
  [92, 300, 24, 4],
  [70, 260, 36, 2],
  [112, 218, 30, 1],
  [96, 172, 22, 3],
  [148, 168, 38, 4],
  [196, 128, 30, 2],
  [178, 92, 20, 1],
  [240, 110, 40, 1],
  [292, 132, 28, 3],
  [282, 82, 18, 4],
  [330, 176, 34, 2],
  [318, 230, 22, 1],
  [352, 250, 26, 4],
  [340, 300, 18, 3],
  [124, 128, 14, 2],
  [362, 214, 12, 1],
];

function heroArt() {
  const balloons = BALLOONS.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#hb${c})"/>`).join(
    "",
  );
  const gradient = (n) => `<radialGradient id="hb${n}" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".28" style="stop-color:var(--b${n})"/>
      <stop offset="1" style="stop-color:var(--b${n}-deep)"/></radialGradient>`;
  return `<svg class="hero-art" viewBox="0 0 400 520" role="img" aria-label="Balon süslemesi çizimi">
    <defs>${[1, 2, 3, 4].map(gradient).join("")}</defs>
    ${balloons}
    <g class="hero-art-sparkles" fill="currentColor">
      <path d="m210 236 4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z"/>
      <path d="m268 300 2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5 2.5-6.5Z"/>
      <path d="m160 318 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/>
    </g>
    <text x="214" y="302" text-anchor="middle" class="hero-art-text">Kutlayalım</text>
    <g class="hero-art-cake">
      <rect x="150" y="440" width="128" height="80" rx="8" class="cake-stand"/>
      <rect x="170" y="392" width="88" height="48" rx="8" style="fill:var(--b2)"/>
      <rect x="186" y="356" width="56" height="36" rx="7" style="fill:var(--b1)"/>
      <path d="M170 412c8 6 14-6 22 0s14-6 22 0 14-6 22 0 14-6 22 0" class="cake-drip"/>
      <path d="M214 356v-14" class="cake-candle"/><path d="M214 336c3-3 3-6 0-9-3 3-3 6 0 9Z" style="fill:var(--b3)"/>
    </g>
  </svg>`;
}

function renderHero(c) {
  const { hero } = c;
  const image = safeUrl(hero.image);
  return `<section class="hero" id="top">
    <div class="container hero-grid">
      <div class="hero-copy">
        ${hero.eyebrow ? `<p class="eyebrow reveal">${esc(hero.eyebrow)}</p>` : ""}
        <h1 class="reveal">${esc(hero.title)} ${hero.highlight ? `<em>${esc(hero.highlight)}</em>` : ""}</h1>
        ${hero.subtitle ? `<p class="lead reveal">${esc(hero.subtitle)}</p>` : ""}
        <div class="hero-actions reveal">
          ${hero.primaryCta ? `<a class="btn btn-primary" href="#iletisim">${esc(hero.primaryCta)}${icon("arrow")}</a>` : ""}
          ${hero.secondaryCta ? `<a class="btn btn-ghost" href="#hizmetler">${esc(hero.secondaryCta)}</a>` : ""}
        </div>
      </div>
      <div class="hero-visual reveal">
        <div class="arch">
          ${image ? `<img src="${esc(image)}" alt="${esc(c.settings.siteName)} organizasyon" fetchpriority="high">` : heroArt()}
        </div>
        <span class="orb orb-1"></span><span class="orb orb-2"></span><span class="orb orb-3"></span>
        ${hero.badges
          .slice(0, 3)
          .map(
            (b, i) =>
              `<div class="float-card fc-${i + 1}">${icon(["sparkles", "clock", "heart"][i])}<span>${esc(b)}</span></div>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function renderServices(c) {
  if (!c.services.length) return "";
  return `<section class="section" id="hizmetler">
    <div class="container">
      ${sectionHead(c.sections.services)}
      <div class="services-grid">
        ${c.services
          .map((s) => {
            const image = safeUrl(s.image);
            return `<article class="service-card reveal${image ? " has-image" : ""}">
            ${image ? `<div class="service-media"><img src="${esc(image)}" alt="${esc(s.title)}" loading="lazy"></div>` : `<div class="service-icon">${icon(s.icon)}</div>`}
            <div class="service-body">
              <h3>${esc(s.title)}</h3>
              ${s.text ? `<p>${esc(s.text)}</p>` : ""}
              <div class="service-foot">
                ${s.price ? `<span class="service-price">${esc(s.price)}</span>` : ""}
                <a class="text-link" href="#iletisim" data-event="${esc(s.title)}">Teklif iste${icon("arrow")}</a>
              </div>
            </div>
          </article>`;
          })
          .join("")}
      </div>
    </div>
  </section>`;
}

function renderSteps(c) {
  if (!c.steps.length) return "";
  return `<section class="section section-tint" id="surec">
    <div class="container">
      ${sectionHead(c.sections.process)}
      <ol class="steps">
        ${c.steps
          .map(
            (s, i) => `<li class="step reveal">
            <span class="step-num">${String(i + 1).padStart(2, "0")}</span>
            <h3>${esc(s.title)}</h3>
            ${s.text ? `<p>${esc(s.text)}</p>` : ""}
          </li>`,
          )
          .join("")}
      </ol>
    </div>
  </section>`;
}

function renderPackages(c) {
  if (!c.packages.length) return "";
  return `<section class="section" id="paketler">
    <div class="container">
      ${sectionHead(c.sections.packages)}
      <div class="packages-grid count-${Math.min(c.packages.length, 4)}">
        ${c.packages
          .map(
            (p) => `<article class="package reveal${p.featured ? " is-featured" : ""}">
            ${p.note ? `<p class="package-note">${esc(p.note)}</p>` : ""}
            <h3>${esc(p.name)}</h3>
            <p class="package-price">${p.price ? esc(p.price) : `<span>Size özel teklif</span>`}</p>
            <ul class="package-features">
              ${p.features.map((f) => `<li>${icon("check")}<span>${esc(f)}</span></li>`).join("")}
            </ul>
            <a class="btn ${p.featured ? "btn-primary" : "btn-outline"}" href="#iletisim" data-package="${esc(p.name)}">Bu paketi seç</a>
          </article>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function renderGallery(c) {
  const items = c.gallery.filter((g) => safeUrl(g.image));
  if (!items.length) return "";
  const categories = [...new Set(items.map((g) => g.category.trim()).filter(Boolean))];
  return `<section class="section section-tint" id="galeri">
    <div class="container">
      ${sectionHead(c.sections.gallery)}
      ${
        categories.length > 1
          ? `<div class="gallery-filters reveal" role="group" aria-label="Galeri filtresi">
          <button type="button" class="chip is-active" data-filter="">Tümü</button>
          ${categories.map((cat) => `<button type="button" class="chip" data-filter="${esc(cat)}">${esc(cat)}</button>`).join("")}
        </div>`
          : ""
      }
      <div class="gallery-grid">
        ${items
          .map(
            (g) => `<figure class="gallery-item reveal" data-category="${esc(g.category.trim())}">
            <button type="button" class="gallery-open" aria-label="Büyüt: ${esc(g.caption || "Galeri görseli")}">
              <img src="${esc(safeUrl(g.image))}" alt="${esc(g.caption || g.category || "Organizasyon görseli")}" loading="lazy">
            </button>
            ${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}
          </figure>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function renderAbout(c) {
  const about = c.sections.about;
  const image = safeUrl(about.image);
  return `<section class="section" id="hakkimizda">
    <div class="container about-grid">
      <div class="about-visual reveal">
        ${
          image
            ? `<img src="${esc(image)}" alt="${esc(c.settings.siteName)}" loading="lazy">`
            : `<div class="about-art">${logoMark()}<p>${esc(c.settings.siteName)}</p></div>`
        }
      </div>
      <div class="about-copy">
        ${sectionHead({ ...about, text: "" }, "left")}
        <div class="prose reveal">${paragraphs(about.text)}</div>
        ${
          c.stats.length
            ? `<dl class="stats reveal">${c.stats
                .map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)
                .join("")}</dl>`
            : ""
        }
      </div>
    </div>
  </section>`;
}

function renderTestimonials(c) {
  if (!c.testimonials.length) return "";
  return `<section class="section section-tint" id="yorumlar">
    <div class="container">
      ${sectionHead(c.sections.testimonials)}
      <div class="testimonials">
        ${c.testimonials
          .map(
            (t) => `<figure class="testimonial reveal">
            <div class="stars" aria-label="${t.rating} / 5">${"★".repeat(t.rating)}<span>${"★".repeat(5 - t.rating)}</span></div>
            <blockquote>${esc(t.text)}</blockquote>
            <figcaption><strong>${esc(t.name)}</strong>${t.event ? `<span>${esc(t.event)}</span>` : ""}</figcaption>
          </figure>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function renderFaq(c) {
  if (!c.faq.length) return "";
  return `<section class="section" id="sss">
    <div class="container faq-wrap">
      ${sectionHead(c.sections.faq)}
      <div class="faq">
        ${c.faq
          .map(
            (f) => `<details class="faq-item reveal">
            <summary>${esc(f.q)}<span class="faq-toggle" aria-hidden="true"></span></summary>
            <div class="faq-answer">${paragraphs(f.a)}</div>
          </details>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function contactList(s) {
  const rows = [];
  if (s.phone) rows.push(["phone", "Telefon", `<a href="${esc(telHref(s.phone))}">${esc(s.phone)}</a>`]);
  if (s.whatsapp)
    rows.push([
      "whatsapp",
      "WhatsApp",
      `<a href="${esc(whatsappHref(s))}" target="_blank" rel="noopener">Hemen yazın</a>`,
    ]);
  if (s.email) rows.push(["mail", "E-posta", `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`]);
  if (s.address) {
    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`;
    rows.push(["pin", "Adres", `<a href="${esc(maps)}" target="_blank" rel="noopener">${esc(s.address)}</a>`]);
  }
  if (s.serviceArea) rows.push(["pin", "Hizmet bölgesi", esc(s.serviceArea)]);
  if (s.workingHours) rows.push(["clock", "Çalışma saatleri", esc(s.workingHours)]);
  return rows;
}

function renderContact(c) {
  const s = c.settings;
  const rows = contactList(s);
  const social = socials(s);
  const eventOptions = [...c.services.map((x) => x.title), "Diğer"];
  return `<section class="section section-contact" id="iletisim">
    <div class="container contact-grid">
      <div class="contact-info">
        ${sectionHead(c.sections.contact, "left")}
        ${
          rows.length
            ? `<ul class="contact-list reveal">${rows
                .map(
                  ([ic, label, value]) =>
                    `<li><span class="contact-icon">${icon(ic)}</span><div><small>${label}</small>${value}</div></li>`,
                )
                .join("")}</ul>`
            : ""
        }
        ${
          social.length
            ? `<div class="social reveal">${social
                .map(
                  (x) =>
                    `<a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${x.label}">${icon(x.name)}</a>`,
                )
                .join("")}</div>`
            : ""
        }
      </div>
      <form class="contact-form reveal" id="teklif-formu" novalidate>
        <h3>Teklif formu</h3>
        <div class="form-grid">
          <label class="field"><span>Ad soyad *</span><input name="name" autocomplete="name" required maxlength="80"></label>
          <label class="field"><span>Telefon *</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30" placeholder="05xx xxx xx xx"></label>
          <label class="field"><span>Organizasyon türü</span>
            <select name="eventType"><option value="">Seçiniz</option>${eventOptions.map((o) => `<option>${esc(o)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Tarih</span><input name="date" type="date"></label>
          <label class="field"><span>Kişi sayısı</span><input name="guests" inputmode="numeric" maxlength="30" placeholder="Örn. 30"></label>
          <label class="field"><span>E-posta</span><input name="email" type="email" autocomplete="email" maxlength="120"></label>
          <label class="field field-full"><span>Mesajınız</span><textarea name="message" rows="4" maxlength="3000" placeholder="Konsept, renkler, mekân… aklınızdaki her şeyi yazabilirsiniz."></textarea></label>
          <label class="hp" aria-hidden="true">Web sitesi<input name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <p class="form-status" role="status" aria-live="polite"></p>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Gönder${icon("arrow")}</button>
          ${s.whatsapp ? `<a class="btn btn-whatsapp" href="${esc(whatsappHref(s))}" target="_blank" rel="noopener" data-wa="${esc(s.whatsapp)}">${icon("whatsapp")}WhatsApp'tan yaz</a>` : ""}
        </div>
        <p class="form-note">Bilgileriniz yalnızca size dönüş yapmak için kullanılır.</p>
      </form>
    </div>
  </section>`;
}

function navLinks(c) {
  return [
    c.services.length && ["#hizmetler", "Hizmetler"],
    c.packages.length && ["#paketler", "Paketler"],
    c.gallery.some((g) => safeUrl(g.image)) && ["#galeri", "Galeri"],
    ["#hakkimizda", "Hakkımızda"],
    c.faq.length && ["#sss", "SSS"],
    ["#iletisim", "İletişim"],
  ].filter(Boolean);
}

function renderFooter(c) {
  const s = c.settings;
  const social = socials(s);
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="logo" href="#top">${logoMark()}<span>${esc(s.siteName)}</span></a>
        ${s.tagline ? `<p>${esc(s.tagline)}</p>` : ""}
        ${social.length ? `<div class="social">${social.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${x.label}">${icon(x.name)}</a>`).join("")}</div>` : ""}
      </div>
      <nav class="footer-nav" aria-label="Alt menü">
        <h4>Keşfedin</h4>
        ${navLinks(c)
          .map(([href, label]) => `<a href="${href}">${label}</a>`)
          .join("")}
      </nav>
      <div class="footer-contact">
        <h4>İletişim</h4>
        ${s.phone ? `<a href="${esc(telHref(s.phone))}">${esc(s.phone)}</a>` : ""}
        ${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ""}
        ${s.address ? `<p>${esc(s.address)}</p>` : ""}
        <a href="#iletisim" class="text-link">Teklif formu${icon("arrow")}</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <p>© ${new Date().getFullYear()} ${esc(s.siteName)}. Tüm hakları saklıdır.</p>
    </div>
  </footer>`;
}

function structuredData(c) {
  const s = c.settings;
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: s.siteName,
    description: s.seoDescription,
    url: s.siteUrl,
    ...(s.phone && { telephone: s.phone }),
    ...(s.email && { email: s.email }),
    ...(s.address && { address: s.address }),
    ...(safeUrl(s.ogImage) && { image: new URL(safeUrl(s.ogImage), s.siteUrl).href }),
    ...(socials(s).length && { sameAs: socials(s).map((x) => x.url) }),
  };
  // "<" kaçışı, verinin script etiketini kapatmasını engeller.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function renderPage(c) {
  const s = c.settings;
  const canonical = `${s.siteUrl.replace(/\/$/, "")}/`;
  const ogImage = safeUrl(s.ogImage) || safeUrl(c.hero.image);
  const links = navLinks(c);
  return `<!doctype html>
<html lang="tr" data-theme="${esc(s.theme)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.seoTitle || s.siteName)}</title>
<meta name="description" content="${esc(s.seoDescription)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="tr_TR">
<meta property="og:site_name" content="${esc(s.siteName)}">
<meta property="og:title" content="${esc(s.seoTitle || s.siteName)}">
<meta property="og:description" content="${esc(s.seoDescription)}">
<meta property="og:url" content="${esc(canonical)}">
${ogImage ? `<meta property="og:image" content="${esc(new URL(ogImage, canonical).href)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<meta name="theme-color" content="#fbf7f4">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=${ASSET_VERSION}">
<script type="application/ld+json">${structuredData(c)}</script>
<script type="module" src="/assets/js/site.js?v=${ASSET_VERSION}"></script>
</head>
<body>
<a class="skip-link" href="#icerik">İçeriğe geç</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="logo" href="#top" aria-label="${esc(s.siteName)} ana sayfa">${logoMark()}<span>${esc(s.siteName)}</span></a>
    <nav class="main-nav" id="menu" aria-label="Ana menü">
      ${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}
      <a class="btn btn-primary btn-sm nav-cta" href="#iletisim">Teklif Al</a>
    </nav>
    <button class="menu-toggle" type="button" aria-controls="menu" aria-expanded="false" aria-label="Menüyü aç">${icon("menu")}${icon("close")}</button>
  </div>
</header>
<main id="icerik">
${renderHero(c)}
${renderServices(c)}
${renderSteps(c)}
${renderPackages(c)}
${renderGallery(c)}
${renderAbout(c)}
${renderTestimonials(c)}
${renderFaq(c)}
${renderContact(c)}
</main>
${renderFooter(c)}
${s.whatsapp ? `<a class="wa-float" href="${esc(whatsappHref(s))}" target="_blank" rel="noopener" aria-label="WhatsApp ile yazın">${icon("whatsapp")}</a>` : ""}
<div class="lightbox" hidden>
  <button type="button" class="lightbox-close" aria-label="Kapat">${icon("close")}</button>
  <button type="button" class="lightbox-prev" aria-label="Önceki">${icon("chevron")}</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button type="button" class="lightbox-next" aria-label="Sonraki">${icon("chevron")}</button>
</div>
</body>
</html>`;
}
