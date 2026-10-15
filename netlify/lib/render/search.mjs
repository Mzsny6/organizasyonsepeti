// İlan listesi ve arama sayfası (/ilanlar)
import { isValidLocation } from "../../../public/assets/js/locations.js";
import { SORTS, formatPrice, liveListings, searchIndex } from "../listings.mjs";
import { searchForm } from "./home.mjs";
import { categoryMap, esc, icon, layout, listingCard, pageHero } from "./layout.mjs";
import { isLandingPath, searchPath } from "./urls.mjs";

// Sorgu parametrelerini doğrular; geçersiz değerler yok sayılır.
export function parseSearch(c, params) {
  const get = (k) => String(params.get(k) || "").trim();
  const category = c.categories.find((cat) => cat.slug === get("kategori"));
  const event = c.events.find((e) => e.slug === get("etkinlik"));
  const money = (k) => Math.min(99_999_999, Number(get(k).replace(/\D/g, "")) || 0);
  const il = isValidLocation(get("il")) ? get("il") : "";
  const ilce = il && get("ilce") && isValidLocation(il, get("ilce")) ? get("ilce") : "";
  return {
    q: get("q").slice(0, 80),
    kategori: category?.slug || "",
    category,
    etkinlik: event?.slug || "",
    event,
    min: money("min"),
    max: money("max"),
    il,
    ilce,
    sirala: SORTS[get("sirala")] ? get("sirala") : "onerilen",
    sayfa: Math.max(1, Number.parseInt(get("sayfa"), 10) || 1),
  };
}

function pageTitle(v) {
  const place = [v.il, v.ilce].filter(Boolean).join(" ");
  const what = [v.event?.name, v.category ? v.category.name : v.event ? "" : "Organizatör"].filter(Boolean).join(" ");
  if (v.q) return `"${v.q}" araması`;
  return `${place ? `${place} ` : ""}${what} İlanları`;
}

function pagination(v, pages) {
  if (pages <= 1) return "";
  const current = v.sayfa;
  const nums = [...new Set([1, current - 1, current, current + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const parts = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) parts.push(`<span class="pg-gap">…</span>`);
    parts.push(
      n === current
        ? `<span class="pg-num is-current" aria-current="page">${n}</span>`
        : `<a class="pg-num" href="${esc(searchPath(v, { sayfa: n }))}">${n}</a>`,
    );
  });
  return `<nav class="pagination" aria-label="Sayfalar">
    ${current > 1 ? `<a class="pg-step" href="${esc(searchPath(v, { sayfa: current - 1 }))}" rel="prev">${icon("chevron")}<span>Önceki</span></a>` : ""}
    ${parts.join("")}
    ${current < pages ? `<a class="pg-step is-next" href="${esc(searchPath(v, { sayfa: current + 1 }))}" rel="next"><span>Sonraki</span>${icon("chevron")}</a>` : ""}
  </nav>`;
}

function activeChips(v) {
  const chips = [
    v.q && [`"${v.q}"`, { q: "" }],
    v.category && [v.category.name, { kategori: "" }],
    v.event && [v.event.name, { etkinlik: "" }],
    (v.min || v.max) && [
      v.min && v.max
        ? `${formatPrice(v.min)} – ${formatPrice(v.max)}`
        : v.min
          ? `${formatPrice(v.min)} üzeri`
          : `${formatPrice(v.max)} altı`,
      { min: "", max: "" },
    ],
    v.il && [v.il, { il: "", ilce: "" }],
    v.ilce && [v.ilce, { ilce: "" }],
  ].filter(Boolean);
  if (!chips.length) return "";
  return `<div class="filter-chips">
    ${chips
      .map(
        ([label, o]) =>
          `<a class="filter-chip" href="${esc(searchPath(v, { ...o, sayfa: 1 }))}" aria-label="${esc(label)} filtresini kaldır">${esc(label)}${icon("close")}</a>`,
      )
      .join("")}
    <a class="filter-clear" href="/ilanlar">Tümünü temizle</a>
  </div>`;
}

// Temiz adresli (hizmet / il / etkinlik) sayfaların altında ilgili aramalara bağlantılar
function relatedLinks(c, index, v) {
  const live = liveListings(index);
  const tally = (items, keyOf) => {
    const counts = new Map();
    for (const x of items) for (const key of [keyOf(x)].flat()) counts.set(key, (counts.get(key) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  };
  const chip = (href, iconName, label, n) =>
    `<a class="city-chip" href="${esc(href)}">${icon(iconName)}<span>${esc(label)}</span><em>${n}</em></a>`;
  const byCategory = (items, toPath) =>
    tally(items, (x) => x.category)
      .map(([id, n]) => [c.categories.find((cat) => cat.id === id), n])
      .filter(([cat]) => cat && cat.id !== v.category?.id)
      .map(([cat, n]) => chip(toPath(cat), cat.icon, cat.name, n));
  const byCity = (items, toPath) =>
    tally(items, (x) => x.city)
      .filter(([city]) => city !== v.il)
      .slice(0, 24)
      .map(([city, n]) => chip(toPath(city), "pin", city, n));

  const groups = [];
  const inCategory = v.category ? live.filter((x) => x.category === v.category.id) : [];
  const inCity = v.il ? live.filter((x) => x.city === v.il) : [];
  if (v.category && !v.il) {
    groups.push([
      `İllere göre ${v.category.name}`,
      byCity(inCategory, (il) => searchPath({ kategori: v.kategori, il })),
    ]);
  }
  if (v.il) {
    groups.push([
      v.category ? `${v.il} içindeki diğer hizmetler` : `${v.il} organizasyon hizmetleri`,
      byCategory(inCity, (cat) => searchPath({ kategori: cat.slug, il: v.il })),
    ]);
  }
  if (v.category && v.il) {
    groups.push([
      `Diğer illerde ${v.category.name}`,
      byCity(inCategory, (il) => searchPath({ kategori: v.kategori, il })),
    ]);
  }
  if (v.event) {
    groups.push([
      `${v.event.name} için hizmetler`,
      byCategory(
        live.filter((x) => x.events.includes(v.event.id)),
        (cat) => searchPath({ kategori: cat.slug, etkinlik: v.etkinlik }),
      ),
    ]);
  }
  const html = groups
    .filter(([, chips]) => chips.length)
    .map(
      ([title, chips]) =>
        `<div class="related-group"><h2>${esc(title)}</h2><div class="related-chips">${chips.join("")}</div></div>`,
    )
    .join("");
  return html
    ? `<section class="section section-tint related-links"><div class="container">${html}</div></section>`
    : "";
}

export function renderSearch(c, index, params) {
  const v = parseSearch(c, params);
  const result = searchIndex(index, {
    category: v.category?.id,
    event: v.event?.id,
    min: v.min,
    max: v.max,
    city: v.il,
    district: v.ilce,
    q: v.q,
    sort: v.sirala,
    page: v.sayfa,
  });
  v.sayfa = result.page;
  const landing = isLandingPath(searchPath(v, { sayfa: 1 }));
  const cats = categoryMap(c);
  const title = pageTitle(v);
  const crumbs = [
    ["Ana sayfa", "/"],
    ["İlanlar", v.category || v.event || v.il || v.q ? "/ilanlar" : ""],
  ];
  if (v.category) crumbs.push([v.category.name, v.il || v.q ? searchPath({ kategori: v.kategori }) : ""]);
  if (v.il) crumbs.push([v.ilce ? `${v.il} / ${v.ilce}` : v.il, ""]);

  const results = result.items.length
    ? `<div class="listing-grid is-3">${result.items.map((x, i) => listingCard(x, cats, { eager: i < 3 })).join("")}</div>${pagination(v, result.pages)}`
    : `<div class="empty-state is-compact">
        <span class="empty-icon">${icon("search")}</span>
        <h2>Bu kriterlere uygun ilan bulunamadı</h2>
        <p>Filtreleri azaltmayı ya da farklı bir il veya kategori seçmeyi deneyin.</p>
        <a class="btn btn-light" href="/ilanlar">Tüm ilanları göster</a>
      </div>`;

  const body = `${pageHero({
    crumbs,
    title,
    text: `${result.total.toLocaleString("tr-TR")} ilan bulundu${landing && result.total ? " · Fiyatları karşılaştırın, organizatörlere komisyonsuz ve doğrudan ulaşın." : ""}`,
  })}
  <section class="section search-section">
    <div class="container search-layout">
      <aside class="filters" aria-label="Filtreler">
        <button class="btn btn-light filters-toggle" type="button" aria-expanded="false" aria-controls="filtreler">${icon("filter")}Filtrele</button>
        <div class="filters-panel" id="filtreler">
          ${searchForm(c, v, { compact: true, extended: true, hidden: { sirala: v.sirala === "onerilen" ? "" : v.sirala } })}
        </div>
      </aside>
      <div class="results">
        <div class="results-bar">
          ${activeChips(v)}
          <form class="sort-form" action="/ilanlar" method="get">
            ${["q", "kategori", "etkinlik", "il", "ilce", "min", "max"].map((k) => (v[k] ? `<input type="hidden" name="${k}" value="${esc(v[k])}">` : "")).join("")}
            <label><span>Sırala</span>
              <select name="sirala" data-autosubmit>${Object.entries(SORTS)
                .map(([k, label]) => `<option value="${k}"${k === v.sirala ? " selected" : ""}>${label}</option>`)
                .join("")}</select>
            </label>
            <noscript><button class="btn btn-light btn-sm" type="submit">Uygula</button></noscript>
          </form>
        </div>
        ${results}
      </div>
    </div>
  </section>
  ${landing && (v.category || v.il || v.event) ? relatedLinks(c, index, v) : ""}`;

  const hasFilters = v.q || v.category || v.event || v.il;
  return layout(c, {
    title: `${title}${landing && (v.category || v.il || v.event) ? " ve Fiyatları" : ""} | ${c.settings.siteName}`,
    description: `${title}: ${result.total} ilan. Organizatörlerin ilanlarını inceleyin, fiyatları karşılaştırın ve komisyonsuz, doğrudan iletişime geçin.`,
    path: searchPath({ kategori: v.kategori, etkinlik: v.etkinlik, il: v.il, ilce: v.ilce, sayfa: v.sayfa }),
    body,
    // Serbest metin aramaları ve sıralama varyasyonları arama motorlarında ayrı sayfa olarak dizinlenmez.
    noindex: Boolean(v.q || v.min || v.max) || v.sirala !== "onerilen" || (hasFilters && !result.total),
  });
}
