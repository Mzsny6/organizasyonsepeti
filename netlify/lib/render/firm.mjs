// Firma sayfası (/firma/:slug-:id) ve favoriler (/favoriler)
import { firmPath, liveListings } from "../listings.mjs";
import {
  absoluteUrl,
  categoryMap,
  esc,
  fmtRating,
  icon,
  layout,
  listingCard,
  otpDialog,
  pageHero,
  paragraphs,
  stars,
} from "./layout.mjs";
import { searchPath } from "./urls.mjs";

const monthYear = (iso) => new Date(iso).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
const fullDate = (iso) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

function reviewDialog(owner) {
  return `<dialog class="dialog" id="degerlendir">
    <form class="dialog-form" data-review-form data-firm="${esc(owner.id)}" novalidate>
      <header class="dialog-head">
        <h2>Değerlendirme yazın</h2>
        <button type="button" class="icon-btn" data-close-dialog aria-label="Kapat">${icon("close")}</button>
      </header>
      <p class="dialog-lead"><strong>${esc(owner.company)}</strong> ile deneyiminizi diğer müşterilerle paylaşın. Yorumunuz incelendikten sonra adınızın baş harfiyle yayınlanır.</p>
      <fieldset class="star-input">
        <legend>Puanınız</legend>
        <div class="star-input-row">${[5, 4, 3, 2, 1]
          .map(
            (n) =>
              `<input type="radio" id="puan-${n}" name="rating" value="${n}"><label for="puan-${n}" title="${n} yıldız">${icon("star")}<span class="sr-only">${n} yıldız</span></label>`,
          )
          .join("")}</div>
      </fieldset>
      <label class="field"><span>Adınız soyadınız</span><input name="name" autocomplete="name" maxlength="60" required></label>
      <label class="field"><span>Yorumunuz</span><textarea name="comment" rows="4" maxlength="1000" required placeholder="Hizmetin kalitesi, zamanlama, iletişim, fiyat/performans…"></textarea></label>
      <label class="hp" aria-hidden="true">Web sitesi<input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="form-status" role="status" aria-live="polite"></p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-close-dialog>Vazgeç</button>
        <button type="submit" class="btn btn-primary">Gönder</button>
      </div>
    </form>
  </dialog>`;
}

function reviewsSection(owner, reviews, summary) {
  const list = reviews.slice(0, 50);
  return `<section class="section section-tint reviews-section" id="degerlendirmeler">
    <div class="container reviews-layout">
      <aside class="review-summary">
        <h2>Değerlendirmeler</h2>
        ${
          summary
            ? `<p class="review-avg">${fmtRating(summary.avg)}<small>/ 5</small></p>${stars(summary.avg)}<p class="review-count">${summary.count} değerlendirme</p>`
            : `<p class="review-count">Henüz değerlendirme yok.</p>`
        }
        <button type="button" class="btn btn-primary btn-block" data-open-review>${icon("star")}Değerlendirme yaz</button>
        <p class="review-note">${icon("shield")}<span>Yalnızca bu firmaya sitemiz üzerinden teklif isteyen, telefonu doğrulanmış müşteriler değerlendirme yazabilir. Yorumlar yayından önce incelenir.</span></p>
        <p class="form-status" data-review-status role="status" aria-live="polite"></p>
      </aside>
      <div class="review-list">
        ${
          list.length
            ? list
                .map(
                  (r) => `<article class="review">
                    <header>
                      <span class="vendor-avatar" aria-hidden="true">${esc(r.authorName.slice(0, 1))}</span>
                      <div><strong>${esc(r.authorName)}</strong><small>${fullDate(r.createdAt)}</small></div>
                      ${stars(r.rating)}
                    </header>
                    <div class="review-text">${paragraphs(r.comment)}</div>
                    ${
                      r.reply
                        ? `<div class="review-reply"><strong>${esc(owner.company)} yanıtı</strong>${paragraphs(r.reply)}</div>`
                        : ""
                    }
                  </article>`,
                )
                .join("")
            : `<div class="empty-state is-compact"><span class="empty-icon">${icon("star")}</span><h3>İlk değerlendirmeyi siz yazın</h3><p>Bu firmayla çalıştıysanız deneyiminizi paylaşarak diğer müşterilere yardımcı olun.</p></div>`
        }
      </div>
    </div>
  </section>`;
}

// owner: organizatör üye kaydı, index: arama dizini (puanlarla), reviews: yayındaki değerlendirmeler
export function renderFirm(c, owner, index, reviews = []) {
  const cats = categoryMap(c);
  const items = liveListings(index)
    .filter((x) => x.userId === owner.id)
    .sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt));
  const path = firmPath({ company: owner.company, userId: owner.id });
  const categories = [...new Set(items.map((x) => x.category))].map((id) => cats.get(id)).filter(Boolean);
  const cities = [...new Set(items.map((x) => x.city))];
  const count = reviews.length;
  const summary = count ? { avg: reviews.reduce((sum, r) => sum + r.rating, 0) / count, count } : null;

  const facts = [
    owner.phoneVerified ? `<span class="verified">${icon("check")}Onaylı hesap</span>` : "",
    summary
      ? `<a class="firm-rating" href="#degerlendirmeler">${stars(summary.avg)}<strong>${fmtRating(summary.avg)}</strong> (${count} değerlendirme)</a>`
      : "",
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
                  `<a class="pill" href="${esc(searchPath({ kategori: cat.slug }))}">${icon(cat.icon)}${esc(cat.name)}</a>`,
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
  </section>
  ${reviewsSection(owner, reviews, summary)}
  ${reviewDialog(owner)}
  ${otpDialog()}`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: owner.company,
    url: absoluteUrl(c, path),
    ...(cities.length && { areaServed: cities.map((name) => ({ "@type": "City", name })) }),
    ...(summary && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: Math.round(summary.avg * 10) / 10,
        reviewCount: count,
        bestRating: 5,
        worstRating: 1,
      },
      review: reviews.slice(0, 5).map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.authorName },
        datePublished: r.createdAt.slice(0, 10),
        reviewBody: r.comment,
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      })),
    }),
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
