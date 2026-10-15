// Yasal metinler, iletişim ve "bulunamadı" sayfaları
import { esc, icon, layout, pageHero, richText, socials, telHref, whatsappHref } from "./layout.mjs";

function legalVars(c) {
  const s = c.settings;
  const contact = [s.siteName, s.address, s.phone && `Telefon: ${s.phone}`, s.email && `E-posta: ${s.email}`]
    .filter(Boolean)
    .join("\n");
  return { siteName: s.siteName, phone: s.phone, email: s.email, address: s.address, contact };
}

const LEGAL = {
  kvkk: { key: "kvkk", title: "KVKK Aydınlatma Metni", eyebrow: "Kişisel verilerin korunması" },
  terms: { key: "terms", title: "Kullanım Koşulları", eyebrow: "Yasal" },
};

export function renderLegal(c, which) {
  const page = LEGAL[which];
  const path = which === "kvkk" ? "/kvkk" : "/kullanim-kosullari";
  const body = `${pageHero({
    crumbs: [
      ["Ana sayfa", "/"],
      [page.title, ""],
    ],
    eyebrow: page.eyebrow,
    title: page.title,
  })}
  <section class="section legal-section">
    <div class="container legal-inner">
      <div class="legal-text">${richText(c.legal[page.key], legalVars(c))}</div>
    </div>
  </section>`;
  return layout(c, {
    title: `${page.title} | ${c.settings.siteName}`,
    description: `${c.settings.siteName} ${page.title.toLocaleLowerCase("tr")}.`,
    path,
    body,
  });
}

export function renderContact(c) {
  const s = c.settings;
  const rows = [
    s.phone && ["phone", "Telefon", `<a href="${esc(telHref(s.phone))}">${esc(s.phone)}</a>`],
    s.whatsapp && [
      "whatsapp",
      "WhatsApp",
      `<a href="${esc(whatsappHref(s))}" target="_blank" rel="noopener">Hemen yazın</a>`,
    ],
    s.email && ["mail", "E-posta", `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`],
    s.address && ["pin", "Adres", esc(s.address)],
    s.workingHours && ["clock", "Çalışma saatleri", esc(s.workingHours)],
  ].filter(Boolean);
  const social = socials(s);

  const body = `${pageHero({
    crumbs: [
      ["Ana sayfa", "/"],
      ["İletişim", ""],
    ],
    eyebrow: "İletişim",
    title: "Bize ulaşın",
    text: "Üyelik, ilanlar, iş birliği ya da öneri… Mesajınızı bırakın, en kısa sürede dönüş yapalım.",
  })}
  <section class="section">
    <div class="container contact-grid">
      <div class="contact-info">
        <div class="note-card">
          ${icon("sparkles")}
          <p><strong>Bir organizasyon firmasına ulaşmak mı istiyorsunuz?</strong> İlan sayfasındaki telefon ve WhatsApp butonlarıyla firmaya doğrudan yazabilirsiniz. ${esc(s.siteName)} hizmetlerin tarafı değildir.</p>
        </div>
        ${
          rows.length
            ? `<ul class="contact-list">${rows
                .map(
                  ([ic, label, value]) =>
                    `<li><span class="contact-icon">${icon(ic)}</span><div><small>${label}</small>${value}</div></li>`,
                )
                .join("")}</ul>`
            : ""
        }
        ${social.length ? `<div class="social">${social.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${x.label}">${icon(x.name)}</a>`).join("")}</div>` : ""}
      </div>
      <form class="contact-form" id="iletisim-formu" novalidate>
        <h2>Mesaj gönderin</h2>
        <div class="form-grid">
          <label class="field"><span>Ad soyad *</span><input name="name" autocomplete="name" required maxlength="80"></label>
          <label class="field"><span>Telefon *</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30" placeholder="05xx xxx xx xx"></label>
          <label class="field"><span>E-posta</span><input name="email" type="email" autocomplete="email" maxlength="120"></label>
          <label class="field"><span>Konu</span>
            <select name="eventType">
              <option>Genel soru</option>
              <option>Üyelik ve ilanlar</option>
              <option>Reklam ve iş birliği</option>
              <option>Şikâyet</option>
            </select>
          </label>
          <label class="field field-full"><span>Mesajınız *</span><textarea name="message" rows="5" maxlength="3000" required></textarea></label>
          <label class="hp" aria-hidden="true">Web sitesi<input name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <p class="form-status" role="status" aria-live="polite"></p>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Gönder${icon("arrow")}</button>
        </div>
        <p class="form-note">Kişisel verileriniz <a href="/kvkk">KVKK Aydınlatma Metni</a> kapsamında yalnızca size dönüş yapmak amacıyla işlenir.</p>
      </form>
    </div>
  </section>`;
  return layout(c, {
    title: `İletişim | ${s.siteName}`,
    description: `${s.siteName} ile iletişime geçin.`,
    path: "/iletisim",
    body,
  });
}

export function renderNotFound(c, message = "Aradığınız sayfa bulunamadı.") {
  const body = `<section class="section not-found">
    <div class="container">
      <div class="empty-state">
        <span class="empty-icon">${icon("balloon")}</span>
        <h1>Bu sayfa uçup gitmiş</h1>
        <p>${esc(message)}</p>
        <div class="empty-actions">
          <a class="btn btn-primary" href="/ilanlar">İlanlara göz atın</a>
          <a class="btn btn-light" href="/">Ana sayfa</a>
        </div>
      </div>
    </div>
  </section>`;
  return layout(c, {
    title: `Bulunamadı | ${c.settings.siteName}`,
    description: message,
    path: "/",
    body,
    noindex: true,
  });
}
