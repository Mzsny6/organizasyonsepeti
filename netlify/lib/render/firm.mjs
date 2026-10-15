// Firma sayfası (/firma/:slug-:id) ve favoriler (/favoriler)
import { firmPath, liveListings } from "../listings.mjs";
import { absoluteUrl, categoryMap, esc, icon, layout, listingCard, pageHero } from "./layout.mjs";

const monthYear = (iso) => new Date(iso).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

// owner: organizatör üye kaydı, index: arama dizini
export function renderFirm(c, owner, index) {
  const cats = categoryMap(c);
  const items = liveListings(index)
    .filter((x) => x.userId === owner.id)
    .sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt));
  const path = firmPath({ company: owner.company, userId: owner.id });
  const categories = [...new Set(items.map((x) => x.category))].map((id) => cats.get(id)).filter(Boolean);
  const cities = [...new Set(items.map((x) => x.city))];

  const facts = [
    owner.phoneVerified ? `<span class="verified">${icon("check")}Onaylı hesap</span>` : "",
    `<span>${icon("calendar")}${monthYear(owner.createdAt)} tarihinden beri üye</span>`,
    `<span>${icon("image")}${items.length} yayında ilan</span>`,
    cities.length ? `<span>${icon("pin")}${esc(cities.join(", "))}</span>` : "",
  ].filter(Boolean);

  const body = `${pageHero({
    crumbs: [
      ["Ana sayfa", "/"],
      ["İlanlar", "/ilanlar"],
      [owner.company, ""],
    ],
    eyebrow: "Organizatör",
    title: owner.company,
    text: `<span class="firm-facts">${facts.join("")}</span>`,
  })}
  <section class="section search-section">
    <div class="container">
      ${
        categories.length
          ? `<div class="firm-cats">${categories
              .map(
                (cat) =>
                  `<a class="pill" href="/ilanlar?kategori=${esc(cat.slug)}">${icon(cat.icon)}${esc(cat.name)}</a>`,
              )
              .join("")}</div>`
          : ""
      }
      ${
        items.length
          ? `<div class="listing-grid is-3">${items.map((x, i) => listingCard(x, cats, { eager: i < 3 })).join("")}</div>`
          : `<div class="empty-state is-compact">
              <span class="empty-icon">${icon("store")}</span>
              <h2>Bu firmanın şu an yayında ilanı yok</h2>
              <p>Benzer hizmet veren diğer organizatörlere göz atabilirsiniz.</p>
              <a class="btn btn-light" href="/ilanlar">Tüm ilanlar</a>
            </div>`
      }
    </div>
  </section>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: owner.company,
    url: absoluteUrl(c, path),
    ...(cities.length && { areaServed: cities.map((name) => ({ "@type": "City", name })) }),
  };

  return layout(c, {
    title: `${owner.company} ilanları | ${c.settings.siteName}`,
    description: `${owner.company}: ${categories.map((x) => x.name).join(", ") || "organizasyon hizmetleri"}${cities.length ? ` · ${cities.join(", ")}` : ""}. Tüm ilanları inceleyin, komisyonsuz ve doğrudan iletişime geçin.`,
    path,
    body,
    ld: [ld],
    noindex: !items.length,
  });
}

// ids: tarayıcının favori çerezindeki ilan numaraları (en son eklenen önce)
export function renderFavorites(c, index, ids) {
  const cats = categoryMap(c);
  const live = new Map(liveListings(index).map((x) => [x.id, x]));
  const items = ids.map((id) => live.get(id)).filter(Boolean);
  const body = `${pageHero({
    crumbs: [
      ["Ana sayfa", "/"],
      ["Favorilerim", ""],
    ],
    title: "Favorilerim",
    text: items.length
      ? `${items.length} ilan kaydettiniz. Favorileriniz bu cihazda saklanır.`
      : "Beğendiğiniz ilanları kalp simgesiyle kaydedin, karşılaştırmak için buradan ulaşın.",
  })}
  <section class="section search-section">
    <div class="container" data-favorites-page>
      ${items.length ? `<div class="listing-grid is-3">${items.map((x) => listingCard(x, cats)).join("")}</div>` : ""}
      <div class="empty-state is-compact"${items.length ? " hidden" : ""} data-favorites-empty>
        <span class="empty-icon">${icon("heart")}</span>
        <h2>Henüz favori ilanınız yok</h2>
        <p>İlan kartlarındaki kalp simgesine dokunarak ilanları favorilerinize ekleyebilirsiniz.</p>
        <a class="btn btn-primary" href="/ilanlar">İlanlara göz at</a>
      </div>
    </div>
  </section>`;
  return layout(c, {
    title: `Favorilerim | ${c.settings.siteName}`,
    description: "Kaydettiğiniz organizasyon ilanları.",
    path: "/favoriler",
    body,
    noindex: true,
  });
}
