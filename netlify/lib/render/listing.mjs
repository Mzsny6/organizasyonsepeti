// İlan detay sayfası (/ilan/:slug-:id)
import { REPORT_REASONS, firmPath, formatPrice, liveListings, listingPath, searchIndex } from "../listings.mjs";
import {
  absoluteUrl,
  categoryMap,
  esc,
  icon,
  favButton,
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

// Teklif talebi: ziyaretçi tarih, kişi sayısı ve ayrıntıları yazar; firma panelinden görüp geri döner.
function requestDialog(c, listing) {
  const own = c.events.filter((e) => (listing.events || []).includes(e.id));
  const events = own.length ? own : c.events;
  return `<dialog class="dialog" id="teklif">
    <form class="dialog-form" data-request-form data-listing="${esc(listing.id)}" novalidate>
      <header class="dialog-head">
        <h2>Teklif isteyin</h2>
        <button type="button" class="icon-btn" data-close-dialog aria-label="Kapat">${icon("close")}</button>
      </header>
      <p class="dialog-lead"><strong>${esc(listing.company)}</strong> talebinizi panelinde görür ve size telefonla dönüş yapar. Teklif istemek ücretsizdir ve sizi bağlamaz.</p>
      <div class="form-grid request-grid">
        <label class="field request-name"><span>Adınız soyadınız</span><input name="name" autocomplete="name" maxlength="60" required></label>
        <label class="field" data-request-phone><span>Cep telefonunuz</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx"></label>
        <label class="field"><span>Etkinlik tarihi</span><input name="eventDate" type="date"></label>
        <label class="field"><span>Kişi sayısı</span><input name="guests" inputmode="numeric" maxlength="6" placeholder="Örn. 150"></label>
        ${
          events.length
            ? `<label class="field field-full"><span>Etkinlik türü</span><select name="event"><option value="">Seçiniz</option>${events
                .map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`)
                .join("")}</select></label>`
            : ""
        }
        <label class="field field-full"><span>Ayrıntılar</span><textarea name="message" rows="4" maxlength="1000" required placeholder="Örn. Kadıköy'de akşam 19:00'da başlayacak bir kına gecesi için fiyat almak istiyorum."></textarea></label>
      </div>
      <label class="hp" aria-hidden="true">Web sitesi<input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="form-status" role="status" aria-live="polite"></p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-close-dialog>Vazgeç</button>
        <button type="submit" class="btn btn-primary">Talebi gönder</button>
      </div>
      <p class="form-note">Adınız ve telefon numaranız yalnızca bu firmayla paylaşılır. <a href="/kvkk" target="_blank">KVKK Aydınlatma Metni</a></p>
    </form>
  </dialog>`;
}

// İletişim bariyeri: telefon numarası SMS koduyla doğrulanınca iletişim bilgileri açılır.
function otpDialog() {
  return `<dialog class="dialog" id="dogrulama">
    <form class="dialog-form" data-otp-form novalidate>
      <header class="dialog-head">
        <h2>Telefonunuzu doğrulayın</h2>
        <button type="button" class="icon-btn" data-close-dialog aria-label="Kapat">${icon("close")}</button>
      </header>
      <p class="dialog-lead">Sahte aramaları ve botları engellemek için organizatörün iletişim bilgileri, numaranızı SMS koduyla doğruladıktan sonra görünür. Bu işlem bir kez yapılır.</p>
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

export function renderListing(c, listing, owner, index) {
  const cats = categoryMap(c);
  const cat = cats.get(listing.category);
  const eventList = c.events.filter((e) => (listing.events || []).includes(e.id));
  const path = listingPath(listing);
  // Aynı kategorideki ilanlar (önce aynı şehir), yetmezse aynı şehirdeki diğer ilanlar
  const others = searchIndex(index, { sort: "yeni" }).items.filter((x) => x.id !== listing.id);
  const similar = [
    ...others.filter((x) => x.category === listing.category && x.city === listing.city),
    ...others.filter((x) => x.category === listing.category && x.city !== listing.city),
    ...others.filter((x) => x.category !== listing.category && x.city === listing.city),
  ].slice(0, 4);

  const firmCount = liveListings(index).filter((x) => x.userId === listing.userId).length;

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
          ${
            eventList.length
              ? `<div class="event-chips"><h3>Hizmet verdiği etkinlikler</h3>${eventList
                  .map(
                    (e) => `<a class="pill" href="/ilanlar?etkinlik=${esc(e.slug)}">${icon(e.icon)}${esc(e.name)}</a>`,
                  )
                  .join("")}</div>`
              : ""
          }
        </article>
        ${
          listing.showCalendar
            ? `<section class="busy-calendar" data-busy-calendar data-listing="${esc(listing.id)}">
                <h2>${icon("calendar")}Müsaitlik takvimi</h2>
                <p class="busy-legend"><span class="dot is-busy"></span>Dolu <span class="dot"></span>Müsait olabilir</p>
                <div class="busy-months"><p class="busy-loading">Takvim yükleniyor…</p></div>
                <p class="busy-note">Kesin müsaitlik için organizatörle iletişime geçin.</p>
              </section>`
            : ""
        }
      </div>
      <aside class="listing-side">
        <div class="side-card">
          ${cat ? `<a class="pill" href="${esc(searchLink({}))}">${icon(cat.icon)}${esc(cat.name)}</a>` : ""}
          <div class="side-top">
            <p class="side-price">${priceHtml(listing)}</p>
            ${favButton(listing.id)}
          </div>
          <div class="vendor-box">
            <span class="vendor-avatar" aria-hidden="true">${esc(listing.company.slice(0, 1).toLocaleUpperCase("tr"))}</span>
            <div>
              <a class="vendor-name" href="${esc(firmPath(listing))}">${esc(listing.company)}</a>
              ${owner?.phoneVerified ? `<span class="verified">${icon("check")}Onaylı hesap</span>` : ""}
              ${owner ? `<small>${monthYear(owner.createdAt)} tarihinden beri üye</small>` : ""}
              ${firmCount > 1 ? `<a class="text-link vendor-all" href="${esc(firmPath(listing))}">Firmanın tüm ilanları (${firmCount})${icon("arrow")}</a>` : ""}
            </div>
          </div>
          <div class="contact-actions" data-contact data-listing="${esc(listing.id)}" data-wa-text="${esc(whatsappText)}">
            <button type="button" class="btn btn-action btn-block" data-reveal-phone>${icon("phone")}<span>Hemen Ara</span></button>
            ${listing.whatsapp ? `<button type="button" class="btn btn-whatsapp btn-block" data-open-whatsapp>${icon("whatsapp")}WhatsApp'tan yaz</button>` : ""}
            <button type="button" class="btn btn-outline btn-block" data-open-request>${icon("mail")}Teklif İste</button>
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
  ${reportDialog(listing)}
  ${requestDialog(c, listing)}
  ${otpDialog()}`;

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
