// İlan detay sayfası (/ilan/:slug-:id)
import { REPORT_REASONS, formatPrice, listingPath, searchIndex } from "../listings.mjs";
import {
  absoluteUrl,
  categoryMap,
  esc,
  icon,
  imageUrl,
  layout,
  listingCard,
  locationText,
  pageHero,
  paragraphs,
  priceHtml,
} from "./layout.mjs";

const monthYear = (iso) => new Date(iso).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
const fullDate = (iso) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

function gallery(listing, cat) {
  if (!listing.images.length) {
    return `<div class="gallery-main is-empty"><span class="cl-placeholder">${icon(cat?.icon || "balloon")}</span></div>`;
  }
  const [first, ...rest] = listing.images;
  return `<div class="listing-gallery" data-gallery>
    <button type="button" class="gallery-main" data-index="0" aria-label="Fotoğrafı büyüt">
      <img src="${esc(imageUrl(first, 1200, 900))}" data-full="${esc(imageUrl(first, 1800))}" alt="${esc(listing.title)}" width="1200" height="900" fetchpriority="high">
      ${listing.images.length > 1 ? `<span class="cl-count">${icon("image")}${listing.images.length}</span>` : ""}
    </button>
    ${
      rest.length
        ? `<div class="gallery-thumbs">${listing.images
            .map(
              (
                url,
                i,
              ) => `<button type="button" class="gallery-thumb${i === 0 ? " is-active" : ""}" data-index="${i}" aria-label="${i + 1}. fotoğraf">
                <img src="${esc(imageUrl(url, 240, 180))}" data-large="${esc(imageUrl(url, 1200, 900))}" data-full="${esc(imageUrl(url, 1800))}" alt="" loading="lazy" width="240" height="180">
              </button>`,
            )
            .join("")}</div>`
        : ""
    }
  </div>`;
}

function reportDialog(listing) {
  return `<dialog class="dialog" id="sikayet">
    <form class="dialog-form" data-report-form data-listing="${esc(listing.id)}">
      <header class="dialog-head">
        <h2>İlanı şikâyet et</h2>
        <button type="button" class="icon-btn" data-close-dialog aria-label="Kapat">${icon("close")}</button>
      </header>
      <p class="dialog-lead">Bildiriminiz ekibimiz tarafından incelenir. Kimliğiniz ilan sahibiyle paylaşılmaz.</p>
      <fieldset class="reason-list">
        <legend>Şikâyet nedeni</legend>
        ${Object.entries(REPORT_REASONS)
          .map(
            ([value, label], i) =>
              `<label class="radio"><input type="radio" name="reason" value="${value}"${i === 0 ? " checked" : ""}><span>${esc(label)}</span></label>`,
          )
          .join("")}
      </fieldset>
      <label class="field"><span>Açıklama (isteğe bağlı)</span><textarea name="message" rows="3" maxlength="1000"></textarea></label>
      <label class="hp" aria-hidden="true">Web sitesi<input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="form-status" role="status" aria-live="polite"></p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-close-dialog>Vazgeç</button>
        <button type="submit" class="btn btn-primary">Gönder</button>
      </div>
    </form>
  </dialog>`;
}

export function renderListing(c, listing, owner, index) {
  const cats = categoryMap(c);
  const cat = cats.get(listing.category);
  const path = listingPath(listing);
  // Aynı kategorideki ilanlar (önce aynı şehir), yetmezse aynı şehirdeki diğer ilanlar
  const others = searchIndex(index, { sort: "yeni" }).items.filter((x) => x.id !== listing.id);
  const similar = [
    ...others.filter((x) => x.category === listing.category && x.city === listing.city),
    ...others.filter((x) => x.category === listing.category && x.city !== listing.city),
    ...others.filter((x) => x.category !== listing.category && x.city === listing.city),
  ].slice(0, 4);

  const searchLink = (extra) => `/ilanlar?${new URLSearchParams({ ...(cat ? { kategori: cat.slug } : {}), ...extra })}`;
  const crumbs = [
    ["Ana sayfa", "/"],
    ["İlanlar", "/ilanlar"],
  ];
  if (cat) crumbs.push([cat.name, searchLink({})]);
  crumbs.push([listing.city, searchLink({ il: listing.city })]);

  const whatsappText = `Merhaba, ${c.settings.siteName} üzerindeki "${listing.title}" ilanınız için yazıyorum.`;
  const body = `${pageHero({ crumbs, title: listing.title, text: `${icon("pin")}${esc(locationText(listing))}` })}
  <section class="section listing-section">
    <div class="container listing-layout">
      <div class="listing-main">
        ${gallery(listing, cat)}
        <article class="listing-description">
          <h2>İlan açıklaması</h2>
          <div class="prose">${paragraphs(listing.description)}</div>
        </article>
      </div>
      <aside class="listing-side">
        <div class="side-card">
          ${cat ? `<a class="pill" href="${esc(searchLink({}))}">${icon(cat.icon)}${esc(cat.name)}</a>` : ""}
          <p class="side-price">${priceHtml(listing)}</p>
          <div class="vendor-box">
            <span class="vendor-avatar" aria-hidden="true">${esc(listing.company.slice(0, 1).toLocaleUpperCase("tr"))}</span>
            <div>
              <strong>${esc(listing.company)}</strong>
              ${owner ? `<small>${monthYear(owner.createdAt)} tarihinden beri üye</small>` : ""}
            </div>
          </div>
          <div class="contact-actions" data-contact data-listing="${esc(listing.id)}" data-wa-text="${esc(whatsappText)}">
            <button type="button" class="btn btn-primary btn-block" data-reveal-phone>${icon("phone")}<span>Telefonu göster</span></button>
            ${listing.whatsapp ? `<button type="button" class="btn btn-whatsapp btn-block" data-open-whatsapp>${icon("whatsapp")}WhatsApp'tan yaz</button>` : ""}
            ${listing.instagram ? `<a class="btn btn-light btn-block" href="https://instagram.com/${esc(listing.instagram)}" target="_blank" rel="noopener nofollow">${icon("instagram")}@${esc(listing.instagram)}</a>` : ""}
            <p class="form-status" role="status" aria-live="polite"></p>
          </div>
          <dl class="facts">
            <div><dt>İlan no</dt><dd>${esc(listing.id.toUpperCase())}</dd></div>
            <div><dt>İlan tarihi</dt><dd>${fullDate(listing.publishedAt || listing.createdAt)}</dd></div>
            <div><dt>Konum</dt><dd>${esc(locationText(listing))}</dd></div>
            ${listing.priceMin ? `<div><dt>Fiyat</dt><dd>${formatPrice(listing.priceMin)}${listing.priceNote ? ` (${esc(listing.priceNote)})` : ""}</dd></div>` : ""}
          </dl>
        </div>
        <div class="safety-note">
          ${icon("shield")}
          <p>Ödeme yapmadan önce hizmetin kapsamını, tarihini ve fiyatını firmayla yazılı olarak netleştirin. Kapora talep edilmesi durumunda dikkatli olun.</p>
        </div>
        <button type="button" class="report-link" data-open-dialog="sikayet">${icon("flag")}İlanı şikâyet et</button>
      </aside>
    </div>
  </section>
  ${
    similar.length
      ? `<section class="section section-tint">
          <div class="container">
            <header class="section-head is-left"><div><p class="eyebrow">Benzer ilanlar</p><h2>Bunlar da ilginizi çekebilir</h2></div></header>
            <div class="listing-grid">${similar.map((x) => listingCard(x, cats)).join("")}</div>
          </div>
        </section>`
      : ""
  }
  ${reportDialog(listing)}`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: listing.title,
    description: listing.description.slice(0, 500),
    url: absoluteUrl(c, path),
    serviceType: cat?.name,
    areaServed: { "@type": "City", name: listing.city },
    provider: {
      "@type": "LocalBusiness",
      name: listing.company,
      address: {
        "@type": "PostalAddress",
        addressLocality: listing.district || listing.city,
        addressRegion: listing.city,
        addressCountry: "TR",
      },
    },
    ...(listing.images[0] && { image: listing.images.slice(0, 5).map((u) => absoluteUrl(c, imageUrl(u, 1200))) }),
    ...(listing.priceMin && {
      offers: {
        "@type": "Offer",
        price: listing.priceMin,
        priceCurrency: "TRY",
        availability: "https://schema.org/InStock",
      },
    }),
  };

  return layout(c, {
    title: `${listing.title} | ${locationText(listing)} | ${c.settings.siteName}`,
    description: `${cat ? `${cat.name} · ` : ""}${locationText(listing)} · ${listing.description.replace(/\s+/g, " ").slice(0, 140)}`,
    path,
    ogImage: listing.images[0],
    body,
    ld: [ld],
  });
}
