// Ana sayfa
import { CITY_NAMES } from "../../../public/assets/js/locations.js";
import { countBy, dopingActive, liveListings, searchIndex } from "../listings.mjs";
import { categoryMap, esc, icon, imageUrl, layout, listingCard, paragraphs, safeUrl, sectionHead } from "./layout.mjs";
import { searchPath } from "./urls.mjs";

const BIG_CITIES = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Adana",
  "Konya",
  "Gaziantep",
  "Kocaeli",
  "Mersin",
];

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

export function heroArt() {
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

// Ana sayfadaki ve ilan listesindeki arama formu. İlçe seçenekleri tarayıcıda il seçilince doldurulur.
export function searchForm(c, values = {}, { compact = false, extended = false, hidden = {} } = {}) {
  const option = (value, label, selected) =>
    `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(label)}</option>`;
  const tierLabel = {
    1: "Mekân, ses-ışık ve büyük organizasyon",
    2: "Catering, fotoğraf, müzik ve dekorasyon",
    3: "Çocuk eğlencesi ve animasyon",
  };
  const categoryOptions = [1, 2, 3]
    .map((tier) => {
      const list = c.categories.filter((cat) => cat.tier === tier);
      return list.length
        ? `<optgroup label="${esc(tierLabel[tier])}">${list.map((cat) => option(cat.slug, cat.name, values.kategori === cat.slug)).join("")}</optgroup>`
        : "";
    })
    .join("");
  return `<form class="search-card${compact ? " is-compact" : ""}" action="/ilanlar" method="get" role="search">
    <label class="sf-field sf-q"><span>Ne arıyorsunuz?</span>
      <span class="sf-input">${icon("search")}<input name="q" value="${esc(values.q || "")}" placeholder="Örn. düğün salonu, palyaço" maxlength="80"></span>
    </label>
    <label class="sf-field"><span>Hizmet türü</span>
      <select name="kategori">${option("", "Tüm hizmetler")}${categoryOptions}</select>
    </label>
    ${
      extended
        ? `<label class="sf-field"><span>Etkinlik</span>
      <select name="etkinlik">${option("", "Tüm etkinlikler")}${c.events.map((e) => option(e.slug, e.name, values.etkinlik === e.slug)).join("")}</select>
    </label>`
        : ""
    }
    <label class="sf-field"><span>İl</span>
      <select name="il" data-city-select>${option("", "Tüm Türkiye")}${CITY_NAMES.map((city) => option(city, city, values.il === city)).join("")}</select>
    </label>
    <label class="sf-field"><span>İlçe</span>
      <select name="ilce" data-district-select data-selected="${esc(values.ilce || "")}" ${values.il ? "" : "disabled"}>${option("", "Tüm ilçeler")}</select>
    </label>
    ${
      extended
        ? `<fieldset class="sf-field sf-budget"><span>Bütçe (₺)</span>
      <div class="sf-range">
        <input name="min" inputmode="numeric" placeholder="En az" value="${values.min || ""}" aria-label="En az fiyat">
        <input name="max" inputmode="numeric" placeholder="En çok" value="${values.max || ""}" aria-label="En çok fiyat">
      </div>
    </fieldset>`
        : ""
    }
    ${Object.entries(hidden)
      .filter(([, v]) => v)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join("")}
    <button class="btn btn-primary sf-submit" type="submit">${icon("search")}<span>Ara</span></button>
  </form>`;
}

function hero(c, total) {
  const { hero } = c;
  const image = safeUrl(hero.image);
  return `<section class="hero" id="top">
    <div class="container hero-grid">
      <div class="hero-copy">
        ${hero.eyebrow ? `<p class="eyebrow reveal">${esc(hero.eyebrow)}</p>` : ""}
        <h1 class="reveal">${esc(hero.title)} ${hero.highlight ? `<em>${esc(hero.highlight)}</em>` : ""}</h1>
        ${hero.subtitle ? `<p class="lead reveal">${esc(hero.subtitle)}</p>` : ""}
        <ul class="hero-facts reveal">
          ${total ? `<li><strong>${total.toLocaleString("tr-TR")}</strong> yayında ilan</li>` : ""}
          <li><strong>81</strong> ilde organizatör</li>
          <li><strong>%0</strong> komisyon</li>
        </ul>
      </div>
      <div class="hero-visual reveal">
        <div class="arch">
          ${image ? `<img src="${esc(imageUrl(image, 880))}" alt="" fetchpriority="high">` : heroArt()}
        </div>
        <span class="orb orb-1"></span><span class="orb orb-2"></span><span class="orb orb-3"></span>
        <div class="float-card fc-1">${icon("shield")}<span>Kontrol edilen ilanlar</span></div>
        <div class="float-card fc-2">${icon("phone")}<span>Komisyonsuz, doğrudan iletişim</span></div>
      </div>
    </div>
    <div class="container hero-search reveal">${searchForm(c)}</div>
  </section>`;
}

function events(c, counts) {
  if (!c.events.length) return "";
  return `<section class="section section-events" id="etkinlikler">
    <div class="container">
      ${sectionHead(c.sections.events)}
      <div class="event-row">
        ${c.events
          .map(
            (e) => `<a class="event-tile" href="${esc(searchPath({ etkinlik: e.slug }))}">
              <span class="et-icon">${icon(e.icon)}</span>
              <span class="et-name">${esc(e.name)}</span>
              ${counts[e.id] ? `<span class="et-count">${counts[e.id]} ilan</span>` : ""}
            </a>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function categories(c, counts) {
  if (!c.categories.length) return "";
  return `<section class="section section-tint" id="hizmetler">
    <div class="container">
      ${sectionHead(c.sections.categories)}
      <div class="category-grid">
        ${c.categories
          .map(
            (cat) => `<a class="category-tile" href="${esc(searchPath({ kategori: cat.slug }))}">
              <span class="ct-icon">${icon(cat.icon)}</span>
              <span class="ct-name">${esc(cat.name)}</span>
              <span class="ct-count">${counts[cat.id] ? `${counts[cat.id]} ilan` : "İlk ilanı siz verin"}</span>
            </a>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

// Ana Sayfa Vitrini dopingi: yatay kaydırmalı alan
function showcase(c, items) {
  if (!items.length) return "";
  const cats = categoryMap(c);
  return `<section class="section" id="vitrin">
    <div class="container">
      <header class="section-head is-left">
        <div>${c.sections.featured.eyebrow ? `<p class="eyebrow">${esc(c.sections.featured.eyebrow)}</p>` : ""}<h2>${esc(c.sections.featured.title)}</h2></div>
        <div class="slider-nav">
          <button type="button" class="icon-btn slider-prev" aria-label="Önceki">${icon("chevron")}</button>
          <button type="button" class="icon-btn slider-next" aria-label="Sonraki">${icon("chevron")}</button>
        </div>
      </header>
      <div class="showcase-track" data-slider tabindex="0" aria-label="Vitrin ilanları">
        ${items.map((x) => listingCard(x, cats, { showcase: true })).join("")}
      </div>
    </div>
  </section>`;
}

function listingSection(c, section, items, { id, tint = false, link } = {}) {
  const cats = categoryMap(c);
  return `<section class="section${tint ? " section-tint" : ""}" id="${id}">
    <div class="container">
      ${sectionHead(section, { align: "left", link })}
      <div class="listing-grid">${items.map((x) => listingCard(x, cats)).join("")}</div>
    </div>
  </section>`;
}

function emptyListings() {
  return `<section class="section section-tint" id="son-ilanlar">
    <div class="container">
      <div class="empty-state">
        <span class="empty-icon">${icon("balloon")}</span>
        <h2>İlk ilanlar çok yakında burada</h2>
        <p>Organizatör müsünüz? Üye olun, ilanınızı ilk yayınlayanlardan olun.</p>
        <a class="btn btn-action" href="/hesap/#yeni-ilan">${icon("plus")}İlan Ver</a>
      </div>
    </div>
  </section>`;
}

function cities(c, counts) {
  const ranked = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([city]) => city);
  const list = [...new Set([...ranked, ...BIG_CITIES])].slice(0, 12);
  return `<section class="section section-tint" id="sehirler">
    <div class="container">
      ${sectionHead(c.sections.cities)}
      <div class="city-chips">
        ${list
          .map(
            (city) =>
              `<a class="city-chip" href="${esc(searchPath({ il: city }))}">${icon("pin")}<span>${esc(city)}</span>${counts[city] ? `<em>${counts[city]}</em>` : ""}</a>`,
          )
          .join("")}
      </div>
      <p class="city-all">Aradığınız şehir listede yok mu? <a href="/ilanlar">Tüm ilanlarda il seçerek arayın</a>.</p>
    </div>
  </section>`;
}

function steps(c) {
  if (!c.steps.length) return "";
  return `<section class="section" id="nasil-calisir">
    <div class="container">
      ${sectionHead(c.sections.process)}
      <ol class="steps count-${Math.min(c.steps.length, 4)}">
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

function vendor(c) {
  const v = c.sections.vendor;
  return `<section class="section" id="firmalar">
    <div class="container">
      <div class="vendor-cta reveal">
        <div class="vendor-copy">
          ${v.eyebrow ? `<p class="eyebrow">${esc(v.eyebrow)}</p>` : ""}
          <h2>${esc(v.title)}</h2>
          ${v.text ? `<p class="vendor-text">${esc(v.text)}</p>` : ""}
          ${c.vendorPoints.length ? `<ul class="vendor-points">${c.vendorPoints.map((p) => `<li>${icon("check")}<span>${esc(p)}</span></li>`).join("")}</ul>` : ""}
          <div class="vendor-actions">
            <a class="btn btn-action" href="/hesap/#yeni-ilan">${icon("plus")}İlan Ver</a>
            <a class="btn btn-ghost-light" href="/hesap/">Organizatör girişi</a>
          </div>
        </div>
        <div class="vendor-art" aria-hidden="true">${heroArt()}</div>
      </div>
    </div>
  </section>`;
}

function faq(c) {
  if (!c.faq.length) return "";
  return `<section class="section section-tint" id="sss">
    <div class="container faq-wrap">
      ${sectionHead(c.sections.faq)}
      <div class="faq">
        ${c.faq
          .map(
            (f) => `<details class="faq-item">
            <summary>${esc(f.q)}<span class="faq-toggle" aria-hidden="true"></span></summary>
            <div class="faq-answer">${paragraphs(f.a)}</div>
          </details>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

export function renderHome(c, index) {
  const s = c.settings;
  const live = liveListings(index);
  const showcaseItems = live
    .filter((x) => dopingActive(x, "showcase"))
    .sort((a, b) => (a.dopings.showcase < b.dopings.showcase ? 1 : -1))
    .slice(0, 16);
  const recent = searchIndex(index, { sort: "yeni" }).items.slice(0, 8);
  const body = [
    hero(c, live.length),
    events(c, countBy(index, "events")),
    showcase(c, showcaseItems),
    categories(c, countBy(index, "category")),
    recent.length
      ? listingSection(c, c.sections.recent, recent, {
          id: "son-ilanlar",
          link: { href: "/ilanlar?sirala=yeni", label: "Tüm ilanlar" },
        })
      : emptyListings(),
    cities(c, countBy(index, "city")),
    steps(c),
    vendor(c),
    faq(c),
  ].join("\n");
  return layout(c, {
    title: s.seoTitle || s.siteName,
    description: s.seoDescription,
    path: "/",
    ogImage: c.hero.image,
    body,
    home: true,
  });
}
