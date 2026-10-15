// Üye hesabı: giriş/kayıt, ilanlar, paket ve doping satın alma, ödemeler, randevu takvimi ve profil.
import { CITY_NAMES, districtsOf } from "/assets/js/locations.js";
import {
  api,
  fill,
  fmtDate,
  fmtDay,
  fmtPrice,
  h,
  ic,
  pickFiles,
  setUnauthorizedHandler,
  thumbUrl,
  toast,
  uploadImage,
} from "/assets/js/ui.js";

const app = document.getElementById("app");
const state = {
  user: null,
  listings: [],
  pricing: null,
  categories: [],
  events: [],
  siteName: "Organizasyon Sepeti",
  returnTo: "",
  newRequests: 0,
  bookingDraft: null, // talepten takvime aktarılan kayıt
  blacklistPhone: "", // talepten kara liste formuna aktarılan numara
};
const MAX_IMAGES = 12;
const PRICE_NOTES = ["başlayan fiyatlarla", "paket fiyatı", "kişi başı", "saatlik", "günlük"];
const BOOKING_STATUSES = { option: "Opsiyon", confirmed: "Kesinleşti", done: "Tamamlandı", cancelled: "İptal" };
const BLACKLIST_REASONS = {
  "sahte-adres": "Asılsız ya da yanlış adres verdi",
  "kapida-iptal": "Adrese gidildiğinde iptal etti",
  "odeme-yapmadi": "Hizmet sonrası ödeme yapmadı",
  diger: "Diğer kötü niyetli davranış",
};
const TIER_NAMES = {
  1: "Mekân, ses-ışık ve büyük organizasyon",
  2: "Catering, fotoğraf, müzik ve dekorasyon",
  3: "Çocuk eğlencesi ve animasyon",
};

const go = (hash) => (location.hash === `#${hash}` ? route() : (location.hash = hash));
const categoryOf = (id) => state.categories.find((c) => c.id === id);
const listingUrl = (x) => `/ilan/${x.slug}-${x.id}`;
const nowIso = () => new Date().toISOString();
const isOrganizer = () => state.user?.role === "organizer";

setUnauthorizedHandler(() => {
  if (!state.user) return;
  state.user = null;
  toast("Oturumunuz sona erdi, lütfen tekrar giriş yapın.", "error");
  go("giris");
});

async function refreshMe() {
  const me = await api("/api/account/me", { quiet401: true });
  state.user = me.user;
  state.listings = me.listings;
  state.newRequests = me.newRequests || 0;
  if (me.pricing) state.pricing = me.pricing;
}

/* ---------- Ortak parçalar ---------- */

let uid = 0;
function field(label, control, { help, wide, counter } = {}) {
  // Şifre alanı gibi sarmalanmış kontrollerde etiket içteki girişe bağlanır.
  const input = control.matches("input, select, textarea") ? control : control.querySelector("input, select, textarea");
  const id = input.id || `f${++uid}`;
  input.id = id;
  const count = counter && h("span", { class: "counter" });
  if (count) {
    const update = () => (count.textContent = `${input.value.length} / ${input.maxLength}`);
    input.addEventListener("input", update);
    update();
  }
  return h(
    "div",
    { class: `field${wide ? " field-full" : ""}` },
    h("label", { for: id }, label, count),
    control,
    help && h("small", { class: "field-help" }, help),
  );
}

const statusLine = () => h("p", { class: "form-status", role: "status", "aria-live": "polite" });
function setStatus(el, text, type) {
  el.textContent = text;
  el.className = `form-status${type ? ` is-${type}` : ""}`;
}

function passwordInput(name, autocomplete, placeholder) {
  const input = h("input", { name, type: "password", autocomplete, required: true, minlength: 8, placeholder });
  const toggle = h(
    "button",
    {
      type: "button",
      class: "pw-toggle",
      "aria-label": "Şifreyi göster",
      onclick: () => {
        input.type = input.type === "password" ? "text" : "password";
        toggle.setAttribute("aria-label", input.type === "password" ? "Şifreyi göster" : "Şifreyi gizle");
      },
    },
    ic("eye"),
  );
  return { input, wrap: h("span", { class: "pw-wrap" }, input, toggle) };
}

// Basit pencere: içerik ve butonlar verilir, kapatılınca DOM'dan kaldırılır.
function openDialog(title, ...body) {
  const dialog = h(
    "dialog",
    { class: "dialog acc-dialog", onclose: () => dialog.remove() },
    h(
      "div",
      { class: "dialog-form" },
      h(
        "header",
        { class: "dialog-head" },
        h("h2", {}, title),
        h(
          "button",
          { type: "button", class: "icon-btn", "aria-label": "Kapat", onclick: () => dialog.close() },
          ic("close"),
        ),
      ),
      ...body,
    ),
  );
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

// Havale/EFT ödeme bilgisi (kartla ödeme altyapısı gelene kadar)
function paymentInfo(order) {
  const bank = state.pricing?.bank || {};
  const copy = (text) =>
    h(
      "button",
      {
        type: "button",
        class: "btn btn-light btn-sm",
        onclick: () => navigator.clipboard?.writeText(text).then(() => toast("Kopyalandı.", "success")),
      },
      "Kopyala",
    );
  return h(
    "div",
    { class: "pay-box" },
    h("p", { class: "pay-title" }, ic("wallet"), "Ödeme bekleniyor"),
    h(
      "dl",
      { class: "pay-facts" },
      h("div", {}, h("dt", {}, "Sipariş no"), h("dd", {}, order.no, copy(order.no))),
      h("div", {}, h("dt", {}, "Tutar"), h("dd", {}, h("strong", {}, fmtPrice(order.amount)))),
      bank.iban
        ? [
            h("div", {}, h("dt", {}, "Banka"), h("dd", {}, bank.bankName || "—")),
            h("div", {}, h("dt", {}, "Alıcı"), h("dd", {}, bank.holder || "—")),
            h(
              "div",
              {},
              h("dt", {}, "IBAN"),
              h("dd", {}, h("code", {}, bank.iban), copy(bank.iban.replace(/\s/g, ""))),
            ),
          ]
        : h("div", {}, h("dt", {}, "Banka bilgisi"), h("dd", {}, "Ödeme bilgisi için bizimle iletişime geçin.")),
    ),
    h(
      "p",
      { class: "pay-note" },
      bank.note || "Açıklamaya sipariş numaranızı yazın.",
      ' Ödemeniz onaylandığında işleminiz tamamlanır; durumunu "Ödemeler" sayfasından takip edebilirsiniz.',
    ),
  );
}

/* ---------- Paket seçimi ---------- */

// Kategorinin fiyat kademesine göre paket kartları ve indirim kodu alanı.
function packagePicker(getCategory) {
  let selected = "quarterly";
  let promo = "";
  const cards = h("div", { class: "pkg-grid", role: "radiogroup", "aria-label": "İlan paketi" });
  const summary = h("p", { class: "pkg-summary" });
  const promoInput = h("input", { placeholder: "Örn. MAYA3AY", maxlength: 30, autocapitalize: "characters" });
  const promoStatus = statusLine();
  const tierOf = () => categoryOf(getCategory())?.tier || 3;

  const render = () => {
    const prices = state.pricing.tiers[`t${tierOf()}`];
    fill(
      cards,
      Object.entries(state.pricing.packages).map(([key, pkg]) => {
        const price = state.pricing.freeMode ? 0 : prices[key];
        const months = pkg.days >= 360 ? 12 : Math.round(pkg.days / 30);
        return h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": String(selected === key),
            class: `pkg-card${selected === key ? " is-active" : ""}`,
            onclick: () => {
              selected = key;
              render();
              if (promo) applyPromo();
            },
          },
          key === "yearly"
            ? h("span", { class: "pkg-tag" }, "2 ay bedava")
            : key === "quarterly"
              ? h("span", { class: "pkg-tag" }, "Popüler")
              : null,
          h("strong", {}, pkg.label.replace(/ \(.*\)/, "")),
          h("span", { class: "pkg-price" }, price ? fmtPrice(price) : "Ücretsiz"),
          price && months > 1
            ? h("small", {}, `Aylık ${fmtPrice(Math.round(price / months))}`)
            : h("small", {}, `${pkg.days} gün yayında`),
        );
      }),
    );
    summary.textContent = state.pricing.freeMode
      ? "Lansman döneminde tüm ilan paketleri ücretsiz."
      : getCategory()
        ? `Fiyatlar seçtiğiniz hizmet türünün kademesine (${state.pricing.tiers[`t${tierOf()}`]?.name}) göredir.`
        : "Fiyatlar seçeceğiniz hizmet türüne göre değişir.";
  };
  async function applyPromo() {
    promo = promoInput.value.trim();
    if (!promo) return setStatus(promoStatus, "");
    if (!getCategory()) return setStatus(promoStatus, "Önce hizmet türünü seçin.", "error");
    try {
      const { quote } = await api("/api/account/quote", {
        method: "POST",
        body: { category: getCategory(), type: "package", item: selected, promo },
      });
      setStatus(
        promoStatus,
        `${quote.promo} uygulandı: %${quote.discountPercent} indirim → ödenecek ${quote.amount ? fmtPrice(quote.amount) : "0 ₺ (ücretsiz)"}`,
        "success",
      );
    } catch (err) {
      promo = "";
      setStatus(promoStatus, err.message, "error");
    }
  }
  render();
  const el = h(
    "div",
    { class: "pkg-picker" },
    cards,
    summary,
    state.pricing.freeMode
      ? null
      : h(
          "div",
          { class: "promo-row" },
          field("İndirim kodu (varsa)", promoInput),
          h("button", { type: "button", class: "btn btn-light", onclick: applyPromo }, ic("tag"), "Uygula"),
        ),
    promoStatus,
  );
  return { el, refresh: render, value: () => ({ package: selected, promo }) };
}

/* ---------- Giriş / kayıt ---------- */

function renderAuth(mode) {
  document.title = `${mode === "login" ? "Giriş yap" : "Üye ol"} | ${state.siteName}`;
  const status = statusLine();
  const submit = h(
    "button",
    { class: "btn btn-primary btn-block", type: "submit" },
    mode === "login" ? "Giriş yap" : "Organizatör hesabı aç",
  );

  const loginFields = () => {
    const pw = passwordInput("password", "current-password", "");
    return [
      field(
        "E-posta",
        h("input", { name: "email", type: "email", autocomplete: "email", required: true, autofocus: true }),
      ),
      field("Şifre", pw.wrap),
    ];
  };
  const registerFields = () => {
    const pw = passwordInput("password", "new-password", "En az 8 karakter");
    return [
      h(
        "div",
        { class: "form-grid" },
        field("Ad soyad", h("input", { name: "name", autocomplete: "name", required: true, maxlength: 80 })),
        field(
          "Firma / marka adı",
          h("input", { name: "company", autocomplete: "organization", required: true, maxlength: 80 }),
          {
            help: "İlanlarınızda bu ad görünür.",
          },
        ),
        field(
          "E-posta",
          h("input", { name: "email", type: "email", autocomplete: "email", required: true, maxlength: 120 }),
        ),
        field(
          "Telefon",
          h("input", {
            name: "phone",
            type: "tel",
            autocomplete: "tel",
            inputmode: "tel",
            required: true,
            placeholder: "05xx xxx xx xx",
          }),
        ),
        field(
          "T.C. kimlik no ya da vergi no",
          h("input", { name: "tcVkn", inputmode: "numeric", required: true, maxlength: 11 }),
          {
            help: "Fatura için gereklidir, sitede gösterilmez.",
            wide: true,
          },
        ),
      ),
      field("Şifre", pw.wrap),
      h(
        "label",
        { class: "check" },
        h("input", { type: "checkbox", name: "acceptTerms", required: true }),
        h(
          "span",
          {},
          h("a", { href: "/kullanim-kosullari", target: "_blank" }, "Kullanım koşullarını"),
          " ve ",
          h("a", { href: "/kvkk", target: "_blank" }, "KVKK aydınlatma metnini"),
          " okudum, kabul ediyorum.",
        ),
      ),
      h(
        "label",
        { class: "hp", "aria-hidden": "true" },
        "Web sitesi",
        h("input", { name: "website", tabindex: "-1", autocomplete: "off" }),
      ),
    ];
  };

  const form = h(
    "form",
    {
      class: "auth-form",
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        data.acceptTerms = form.acceptTerms?.checked;
        if (mode === "register" && !data.acceptTerms)
          return setStatus(status, "Devam etmek için koşulları onaylayın.", "error");
        submit.disabled = true;
        setStatus(status, mode === "login" ? "Giriş yapılıyor…" : "Hesabınız oluşturuluyor…");
        try {
          await api(`/api/account/${mode === "login" ? "login" : "register"}`, {
            method: "POST",
            body: data,
            quiet401: true,
          });
          await refreshMe();
          toast(
            mode === "login"
              ? `Hoş geldiniz, ${state.user.name.split(" ")[0] || ""}!`
              : "Hesabınız oluşturuldu. Şimdi ilk ilanınızı verebilirsiniz.",
            "success",
          );
          const next = state.returnTo || (mode === "register" ? "yeni-ilan" : "ilanlarim");
          state.returnTo = "";
          go(next);
        } catch (err) {
          setStatus(status, err.message, "error");
          submit.disabled = false;
        }
      },
    },
    h("h1", {}, mode === "login" ? "Organizatör girişi" : "Organizatör hesabı açın"),
    h(
      "p",
      { class: "auth-sub" },
      state.returnTo === "yeni-ilan"
        ? "İlan vermek için giriş yapın ya da birkaç dakikada organizatör hesabı açın."
        : mode === "login"
          ? "İlanlarınızı, ödemelerinizi ve takviminizi yönetmek için giriş yapın."
          : "Komisyon yok; müşterileriniz size doğrudan ulaşır.",
    ),
    mode === "login" ? loginFields() : registerFields(),
    status,
    submit,
    mode === "login"
      ? h("p", { class: "auth-alt" }, "Şifrenizi mi unuttunuz? ", h("a", { href: "#sifre" }, "SMS ile sıfırlayın"))
      : null,
    h(
      "p",
      { class: "auth-switch" },
      mode === "login" ? "Henüz hesabınız yok mu? " : "Zaten üye misiniz? ",
      h(
        "a",
        { href: mode === "login" ? "#kayit" : "#giris" },
        mode === "login" ? "Organizatör hesabı açın" : "Giriş yapın",
      ),
    ),
  );

  fill(
    app,
    h(
      "section",
      { class: "auth" },
      h(
        "aside",
        { class: "auth-aside" },
        h("p", { class: "eyebrow" }, "Organizatörler için"),
        h("h2", {}, "İşinizi büyütün, komisyon ödemeyin"),
        h(
          "ul",
          {},
          [
            "Müşteriler sizi doğrudan telefon ve WhatsApp'tan arar",
            "Hizmet türünüze göre uygun fiyatlı ilan paketleri",
            "Vitrin ve kategori üst sıra ile öne çıkın",
            "Randevu takvimi ve çifte rezervasyon uyarısı",
            "Kötü niyetli müşterilere karşı kara liste koruması",
          ].map((t) => h("li", {}, ic("check"), h("span", {}, t))),
        ),
      ),
      form,
    ),
  );
  form.querySelector("input")?.focus();
}

// Şifremi unuttum: hesaba kayıtlı doğrulanmış telefona gelen SMS koduyla yeni şifre belirlenir.
function renderReset() {
  document.title = `Şifremi unuttum | ${state.siteName}`;
  const status = statusLine();
  const email = h("input", { name: "email", type: "email", autocomplete: "email", required: true });
  const code = h("input", {
    name: "code",
    inputmode: "numeric",
    autocomplete: "one-time-code",
    maxlength: 6,
    placeholder: "••••••",
  });
  const pw = passwordInput("password", "new-password", "En az 8 karakter");
  const codeStep = h(
    "div",
    { class: "auth-step", hidden: true },
    field("SMS ile gelen kod", code),
    field("Yeni şifre", pw.wrap),
  );
  const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Kod gönder");
  const form = h(
    "form",
    {
      class: "auth-form",
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        submit.disabled = true;
        try {
          if (codeStep.hidden) {
            await api("/api/account/reset/start", { method: "POST", body: { email: email.value } });
            codeStep.hidden = false;
            email.readOnly = true;
            submit.textContent = "Şifremi değiştir";
            setStatus(
              status,
              "Bu e-postaya ait hesapta doğrulanmış bir telefon varsa SMS ile kod gönderdik. Kod birkaç dakika içinde gelmezse aşağıdaki bağlantıdan bize yazın.",
              "success",
            );
            code.focus();
          } else {
            await api("/api/account/reset/finish", {
              method: "POST",
              body: { email: email.value, code: code.value, password: pw.input.value },
              quiet401: true,
            });
            await refreshMe();
            toast("Şifreniz değiştirildi, hoş geldiniz!", "success");
            go("ilanlarim");
          }
        } catch (err) {
          setStatus(status, err.message, "error");
        } finally {
          submit.disabled = false;
        }
      },
    },
    h("h1", {}, "Şifremi unuttum"),
    h(
      "p",
      { class: "auth-sub" },
      "Hesabınızın e-posta adresini yazın. Profilinizde doğruladığınız cep telefonuna SMS ile bir kod göndereceğiz.",
    ),
    field("E-posta", email),
    codeStep,
    status,
    submit,
    h(
      "p",
      { class: "auth-alt" },
      "Telefonunuzu hiç doğrulamadıysanız ",
      h("a", { href: "/iletisim" }, "bize yazın"),
      "; kimliğinizi teyit edip yardımcı olalım.",
    ),
    h("p", { class: "auth-switch" }, h("a", { href: "#giris" }, "Giriş sayfasına dön")),
  );
  fill(app, h("section", { class: "auth is-single" }, form));
  email.focus();
}

/* ---------- Ziyaretçi (telefon doğrulamış) hesabı ---------- */

function renderClient() {
  document.title = `Hesabım | ${state.siteName}`;
  const sent = h("div", { class: "sent-list" });
  api("/api/account/sent-requests")
    .then(({ requests }) =>
      fill(
        sent,
        requests.length ? h("h2", {}, "Teklif talepleriniz") : null,
        requests.map((r) =>
          h(
            "article",
            { class: "sent-item" },
            h(
              "header",
              {},
              h("a", { href: r.listingPath }, r.listingTitle),
              h(
                "span",
                { class: `status status-${r.seen ? "ok" : "warn"}` },
                r.seen ? "Firma inceledi" : "Firmaya iletildi",
              ),
            ),
            h(
              "span",
              { class: "muted" },
              [
                fmtDay(r.createdAt),
                r.eventDate ? `Etkinlik: ${fmtDay(r.eventDate)}` : "",
                r.guests ? `${r.guests} kişi` : "",
              ]
                .filter(Boolean)
                .join(" · "),
            ),
          ),
        ),
      ),
    )
    .catch(() => {});
  fill(
    app,
    h(
      "section",
      { class: "panel client-panel" },
      h("span", { class: "empty-icon is-ok" }, ic("check")),
      h("h1", {}, "Telefon numaranız doğrulandı"),
      h(
        "p",
        {},
        `${state.user.phone} numarasıyla organizatörlerin iletişim bilgilerini görebilir ve teklif isteyebilirsiniz.`,
      ),
      sent,
      h(
        "div",
        { class: "panel-actions is-center" },
        h("a", { class: "btn btn-primary", href: "/ilanlar" }, "İlanlara göz at"),
        h(
          "button",
          { type: "button", class: "btn btn-light", onclick: () => logout().then(() => go("kayit")) },
          "Organizatör hesabı aç",
        ),
        h("button", { type: "button", class: "btn btn-ghost", onclick: logout }, "Çıkış"),
      ),
      h(
        "button",
        {
          type: "button",
          class: "link-btn danger",
          onclick: async () => {
            if (!confirm("Doğrulanmış numaranız ve gönderdiğiniz teklif talepleri silinsin mi?")) return;
            await api("/api/account", { method: "DELETE", body: {} });
            state.user = null;
            toast("Hesabınız silindi.");
            go("giris");
          },
        },
        "Hesabımı ve verilerimi sil",
      ),
    ),
  );
}

/* ---------- Hesap kabuğu ---------- */

function shell(page) {
  const tab = (hash, label, icon, badge) =>
    h(
      "a",
      {
        href: `#${hash}`,
        class: `acc-tab${page === hash ? " is-active" : ""}`,
        "aria-current": page === hash ? "page" : null,
      },
      ic(icon),
      h("span", {}, label),
      badge ? h("b", { class: "tab-badge", "aria-label": `${badge} yeni` }, String(badge)) : null,
    );
  const view = h("div", { class: "acc-view", id: "view" });
  const u = state.user;
  fill(
    app,
    h(
      "section",
      { class: "acc" },
      h(
        "header",
        { class: "acc-head" },
        h(
          "div",
          { class: "acc-hello" },
          h("span", { class: "vendor-avatar", "aria-hidden": "true" }, u.company.slice(0, 1).toLocaleUpperCase("tr")),
          h(
            "div",
            {},
            h("p", { class: "eyebrow" }, "Organizatör hesabı"),
            h("h1", {}, u.company, u.phoneVerified ? h("span", { class: "verified" }, ic("check"), "Onaylı") : null),
            h("p", {}, u.name, " · ", u.email),
          ),
        ),
        h(
          "nav",
          { class: "acc-tabs", "aria-label": "Hesap menüsü" },
          tab("ilanlarim", "İlanlarım", "image"),
          tab("yeni-ilan", "Yeni ilan", "plus"),
          tab("talepler", "Talepler", "mail", state.newRequests),
          tab("takvim", "Takvim", "calendar"),
          tab("odemeler", "Ödemeler", "wallet"),
          tab("profil", "Profil", "user"),
          h("button", { type: "button", class: "acc-tab", onclick: logout }, ic("logout"), h("span", {}, "Çıkış")),
        ),
      ),
      view,
    ),
  );
  return view;
}

async function logout() {
  await api("/api/account/logout", { method: "POST", body: {} }).catch(() => {});
  state.user = null;
  toast("Çıkış yapıldı.");
  go("giris");
}

/* ---------- İlanlarım ---------- */

function statusOf(x) {
  const now = nowIso();
  const paid = x.credit > 0 || (x.expiresAt && x.expiresAt > now);
  if (x.status === "rejected") return ["Reddedildi", "bad", ""];
  if (x.status === "passive") return ["Yayında değil", "muted", ""];
  if (x.status === "pending") {
    if (x.awaitingOrder)
      return ["Ödeme bekleniyor", "warn", "Havale/EFT ödemeniz onaylandığında ilanınız kontrole alınır."];
    if (!paid) return ["Paket gerekli", "warn", "Yayına girmesi için bir ilan paketi seçin."];
    return ["Onay bekliyor", "warn", "İlanınız kontrol ediliyor. Onaylandığında yayına girecek."];
  }
  if (!x.expiresAt || x.expiresAt <= now) return ["Süresi doldu", "bad", "Paketinizi yenileyerek tekrar yayına alın."];
  return ["Yayında", "ok", `${fmtDay(x.expiresAt)} tarihine kadar yayında.`];
}

function dopingBadges(x) {
  const now = nowIso();
  const labels = { showcase: "Vitrin", categoryTop: "Üst sıra", highlight: "Renkli çerçeve" };
  return Object.entries(x.dopings || {})
    .filter(([, until]) => until > now)
    .map(([key, until]) =>
      h(
        "span",
        { class: "status status-accent", title: `${fmtDay(until)} tarihine kadar` },
        ic("rocket"),
        labels[key] || key,
      ),
    );
}

function renderListings(view) {
  document.title = `İlanlarım | ${state.siteName}`;

  const row = (x) => {
    const [label, tone, note] = statusOf(x);
    const live = label === "Yayında";
    const actions = [];
    if (live)
      actions.push(
        h("a", { class: "btn btn-light btn-sm", href: listingUrl(x), target: "_blank" }, ic("eye"), "Görüntüle"),
      );
    actions.push(h("a", { class: "btn btn-light btn-sm", href: `#duzenle/${x.id}` }, ic("edit"), "Düzenle"));
    if (label === "Paket gerekli" || label === "Süresi doldu" || live) {
      actions.push(
        h(
          "button",
          { type: "button", class: `btn btn-sm ${live ? "btn-light" : "btn-action"}`, onclick: () => renewDialog(x) },
          ic("wallet"),
          live ? "Süre uzat" : "Paket al",
        ),
      );
    }
    if (live)
      actions.push(
        h(
          "button",
          { type: "button", class: "btn btn-primary btn-sm", onclick: () => dopingDialog(x) },
          ic("rocket"),
          "Öne çıkar",
        ),
      );
    if (x.status === "active" || x.status === "pending") actions.push(statusButton(x, "Yayından kaldır", false));
    if (x.status === "passive") actions.push(statusButton(x, "Yeniden yayınla", true));
    actions.push(
      h(
        "button",
        {
          type: "button",
          class: "btn btn-ghost btn-sm danger",
          onclick: async () => {
            if (!confirm(`"${x.title}" ilanı ve fotoğrafları kalıcı olarak silinsin mi?`)) return;
            try {
              await api(`/api/account/listings/${x.id}`, { method: "DELETE" });
              state.listings = state.listings.filter((l) => l.id !== x.id);
              toast("İlan silindi.");
              route();
            } catch (err) {
              toast(err.message, "error");
            }
          },
        },
        "Sil",
      ),
    );
    const cat = categoryOf(x.category);
    return h(
      "article",
      { class: "my-listing" },
      h(
        "a",
        { class: "ml-thumb", href: `#duzenle/${x.id}`, tabindex: "-1" },
        x.image ? h("img", { src: thumbUrl(x.image, 360, 270), alt: "" }) : ic("image"),
      ),
      h(
        "div",
        { class: "ml-body" },
        h(
          "div",
          { class: "ml-top" },
          h("span", { class: `status status-${tone}` }, label),
          dopingBadges(x),
          h("span", { class: "ml-date" }, `İlan no ${x.id.toUpperCase()}`),
        ),
        h("h3", {}, x.title),
        h(
          "p",
          { class: "ml-meta" },
          [
            cat?.name || "Kategori yok",
            x.district ? `${x.city} / ${x.district}` : x.city,
            x.priceMin ? fmtPrice(x.priceMin) : "Fiyat belirtilmedi",
          ].join(" · "),
        ),
        x.status === "rejected" && x.rejectReason
          ? h(
              "p",
              { class: "ml-reason" },
              h("strong", {}, "Red nedeni: "),
              x.rejectReason,
              " İlanı düzenleyip tekrar gönderebilirsiniz.",
            )
          : null,
        note ? h("p", { class: `ml-note is-${tone}` }, note) : null,
        h(
          "p",
          { class: "ml-stats" },
          ic("chart"),
          `${x.stats?.phone || 0} telefon · ${x.stats?.whatsapp || 0} WhatsApp tıklaması · ${x.stats?.request || 0} teklif talebi`,
        ),
        h("div", { class: "ml-actions" }, actions),
      ),
    );
  };

  fill(
    view,
    h(
      "div",
      { class: "acc-toolbar" },
      h("h2", { class: "acc-title" }, "İlanlarım"),
      h("a", { class: "btn btn-action", href: "#yeni-ilan" }, ic("plus"), "Yeni ilan ver"),
    ),
    state.listings.length
      ? h("div", { class: "my-listings" }, state.listings.map(row))
      : h(
          "div",
          { class: "empty-state is-compact" },
          h("span", { class: "empty-icon" }, ic("balloon")),
          h("h2", {}, "Henüz ilanınız yok"),
          h(
            "p",
            {},
            "Hizmetlerinizi fotoğraflarıyla anlatan ilk ilanınızı oluşturun. Paketinizi seçin, kontrolden sonra yayına girsin.",
          ),
          h("a", { class: "btn btn-action", href: "#yeni-ilan" }, ic("plus"), "İlk ilanımı oluştur"),
        ),
  );
}

function statusButton(x, label, active) {
  return h(
    "button",
    {
      type: "button",
      class: "btn btn-light btn-sm",
      onclick: async (e) => {
        const button = e.currentTarget;
        button.disabled = true;
        try {
          const { listing } = await api(`/api/account/listings/${x.id}/status`, { method: "POST", body: { active } });
          await refreshMe();
          toast(
            listing.status === "active"
              ? "İlan yeniden yayında."
              : listing.status === "pending"
                ? "İlan onaya gönderildi."
                : "İlan yayından kaldırıldı.",
            "success",
          );
          route();
        } catch (err) {
          toast(err.message, "error");
          button.disabled = false;
        }
      },
    },
    label,
  );
}

async function afterOrder(order, dialog, successText) {
  await refreshMe();
  if (order.status === "awaiting") {
    fill(
      dialog.querySelector(".dialog-form"),
      h(
        "header",
        { class: "dialog-head" },
        h("h2", {}, "Siparişiniz alındı"),
        h(
          "button",
          { type: "button", class: "icon-btn", "aria-label": "Kapat", onclick: () => dialog.close() },
          ic("close"),
        ),
      ),
      paymentInfo(order),
      h(
        "div",
        { class: "dialog-actions" },
        h("button", { type: "button", class: "btn btn-primary", onclick: () => dialog.close() }, "Tamam"),
      ),
    );
  } else {
    dialog.close();
    toast(successText, "success");
  }
  route();
}

function renewDialog(x) {
  const picker = packagePicker(() => x.category);
  const status = statusLine();
  const submit = h(
    "button",
    {
      type: "button",
      class: "btn btn-action",
      onclick: async () => {
        submit.disabled = true;
        try {
          const { order } = await api(`/api/account/listings/${x.id}/renew`, { method: "POST", body: picker.value() });
          await afterOrder(order, dialog, "Paketiniz tanımlandı.");
        } catch (err) {
          setStatus(status, err.message, "error");
          submit.disabled = false;
        }
      },
    },
    "Devam et",
  );
  const dialog = openDialog(
    "İlan paketi seçin",
    h("p", { class: "dialog-lead" }, x.title),
    picker.el,
    status,
    h("div", { class: "dialog-actions" }, submit),
  );
}

function dopingDialog(x) {
  let selected = "showcase";
  const options = h("div", { class: "doping-list", role: "radiogroup" });
  const render = () =>
    fill(
      options,
      Object.entries(state.pricing.dopings).map(([key, d]) =>
        h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": String(selected === key),
            class: `doping-option${selected === key ? " is-active" : ""}`,
            onclick: () => ((selected = key), render()),
          },
          h(
            "span",
            { class: "doping-icon" },
            ic(key === "showcase" ? "star" : key === "categoryTop" ? "rocket" : "badge"),
          ),
          h("span", { class: "doping-text" }, h("strong", {}, d.label), h("small", {}, d.where)),
          h(
            "span",
            { class: "doping-price" },
            d.price ? fmtPrice(d.price) : "Ücretsiz",
            h("small", {}, `${d.days} gün`),
          ),
        ),
      ),
    );
  render();
  const status = statusLine();
  const submit = h(
    "button",
    {
      type: "button",
      class: "btn btn-action",
      onclick: async () => {
        submit.disabled = true;
        try {
          const { order } = await api(`/api/account/listings/${x.id}/doping`, {
            method: "POST",
            body: { doping: selected },
          });
          await afterOrder(order, dialog, "Doping tanımlandı, ilanınız öne çıktı!");
        } catch (err) {
          setStatus(status, err.message, "error");
          submit.disabled = false;
        }
      },
    },
    "Satın al",
  );
  const dialog = openDialog(
    "İlanınızı öne çıkarın",
    h("p", { class: "dialog-lead" }, x.title),
    options,
    status,
    h("div", { class: "dialog-actions" }, submit),
  );
}

/* ---------- İlan formu ---------- */

async function renderEditor(view, id) {
  document.title = `${id ? "İlanı düzenle" : "Yeni ilan"} | ${state.siteName}`;
  let listing = {
    title: "",
    category: "",
    events: [],
    city: "",
    district: "",
    priceMin: "",
    priceNote: "",
    description: "",
    images: [],
    phone: state.user.phone,
    whatsapp: true,
    instagram: "",
    showCalendar: false,
  };
  if (id) {
    fill(view, h("p", { class: "loading" }, "Yükleniyor…"));
    try {
      listing = (await api(`/api/account/listings/${id}`)).listing;
    } catch (err) {
      toast(err.message, "error");
      return go("ilanlarim");
    }
  }
  const images = [...listing.images];
  const events = new Set(listing.events || []);

  const option = (value, label, selected) => h("option", { value, selected }, label);
  const title = h("input", {
    name: "title",
    value: listing.title,
    maxlength: 90,
    required: true,
    placeholder: "Örn. Kadıköy'de profesyonel balon süsleme",
  });
  const category = h(
    "select",
    { name: "category", required: true },
    option("", "Hizmet türünü seçin", !listing.category),
    [1, 2, 3].map((tier) =>
      h(
        "optgroup",
        { label: TIER_NAMES[tier] },
        state.categories.filter((c) => c.tier === tier).map((c) => option(c.id, c.name, c.id === listing.category)),
      ),
    ),
  );
  const city = h(
    "select",
    { name: "city", required: true },
    option("", "İl seçin", !listing.city),
    CITY_NAMES.map((c) => option(c, c, c === listing.city)),
  );
  const district = h("select", { name: "district" });
  const fillDistricts = (selected = "") => {
    fill(
      district,
      option("", city.value ? "Tüm ilçeler (il geneli)" : "Önce il seçin", !selected),
      districtsOf(city.value).map((d) => option(d, d, d === selected)),
    );
    district.disabled = !city.value;
  };
  city.addEventListener("change", () => fillDistricts());
  fillDistricts(listing.district);

  const eventChips = h(
    "div",
    { class: "chip-select" },
    state.events.map((e) => {
      const chip = h(
        "button",
        {
          type: "button",
          class: `chip-toggle${events.has(e.id) ? " is-on" : ""}`,
          "aria-pressed": String(events.has(e.id)),
          onclick: () => {
            if (events.has(e.id)) events.delete(e.id);
            else events.add(e.id);
            chip.classList.toggle("is-on", events.has(e.id));
            chip.setAttribute("aria-pressed", String(events.has(e.id)));
          },
        },
        ic(e.icon),
        e.name,
      );
      return chip;
    }),
  );

  const description = h("textarea", {
    name: "description",
    rows: 9,
    maxlength: 5000,
    required: true,
    value: listing.description,
    placeholder: "Sunduğunuz hizmeti, pakete dahil olanları, kapasiteyi, kurulum ve teslim detaylarını anlatın.",
  });
  const price = h("input", {
    name: "priceMin",
    inputmode: "numeric",
    value: listing.priceMin ? Number(listing.priceMin).toLocaleString("tr-TR") : "",
    placeholder: "Örn. 2.500",
  });
  price.addEventListener("input", () => {
    const digits = price.value.replace(/\D/g, "").slice(0, 8);
    price.value = digits ? Number(digits).toLocaleString("tr-TR") : "";
  });
  const priceNote = h("input", {
    name: "priceNote",
    value: listing.priceNote,
    maxlength: 40,
    list: "price-notes",
    placeholder: "Örn. başlayan fiyatlarla",
  });
  const phone = h("input", { name: "phone", type: "tel", inputmode: "tel", value: listing.phone, required: true });
  const whatsapp = h("input", { type: "checkbox", name: "whatsapp", checked: listing.whatsapp });
  const instagram = h("input", {
    name: "instagram",
    value: listing.instagram ? `@${listing.instagram}` : "",
    placeholder: "@kullaniciadi",
  });
  const showCalendar = h("input", { type: "checkbox", name: "showCalendar", checked: listing.showCalendar });

  // Fotoğraflar
  const gallery = h("div", { class: "photo-grid" });
  const photoStatus = h("span", { class: "photo-status" });
  const move = (from, to) => {
    images.splice(to, 0, images.splice(from, 1)[0]);
    renderPhotos();
  };
  const renderPhotos = () => {
    fill(
      gallery,
      images.map((url, i) =>
        h(
          "figure",
          { class: "photo" },
          h("img", { src: thumbUrl(url), alt: "" }),
          i === 0 ? h("span", { class: "photo-cover" }, "Kapak") : null,
          h(
            "div",
            { class: "photo-actions" },
            h(
              "button",
              {
                type: "button",
                class: "icon-btn",
                "aria-label": "Öne al",
                disabled: i === 0,
                onclick: () => move(i, i - 1),
              },
              ic("chevron", "icon rot-left"),
            ),
            h(
              "button",
              {
                type: "button",
                class: "icon-btn",
                "aria-label": "Sona al",
                disabled: i === images.length - 1,
                onclick: () => move(i, i + 1),
              },
              ic("chevron"),
            ),
            h(
              "button",
              {
                type: "button",
                class: "icon-btn danger",
                "aria-label": "Kaldır",
                onclick: () => {
                  images.splice(i, 1);
                  renderPhotos();
                },
              },
              ic("close"),
            ),
          ),
        ),
      ),
      images.length < MAX_IMAGES
        ? h(
            "button",
            { type: "button", class: "photo-add", onclick: addPhotos },
            ic("plus"),
            h("span", {}, images.length ? "Fotoğraf ekle" : "Fotoğraf yükle"),
            h("small", {}, `${images.length} / ${MAX_IMAGES}`),
          )
        : null,
    );
  };
  async function addPhotos() {
    const files = (await pickFiles({ multiple: true })).slice(0, MAX_IMAGES - images.length);
    for (const [n, file] of files.entries()) {
      photoStatus.textContent = `Yükleniyor ${n + 1} / ${files.length}…`;
      try {
        images.push(await uploadImage(file));
        renderPhotos();
      } catch (err) {
        toast(err.message, "error");
      }
    }
    photoStatus.textContent = "";
  }
  renderPhotos();

  const picker = id ? null : packagePicker(() => category.value);
  category.addEventListener("change", () => picker?.refresh());

  const status = statusLine();
  const submit = h(
    "button",
    { class: "btn btn-action", type: "submit" },
    id ? "Kaydet ve onaya gönder" : "Devam et ve gönder",
  );
  const form = h(
    "form",
    {
      class: "editor",
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const problem =
          (title.value.trim().length < 10 && [title, "İlan başlığı en az 10 karakter olmalı."]) ||
          (!category.value && [category, "Lütfen hizmet türünü seçin."]) ||
          (!city.value && [city, "Lütfen il seçin."]) ||
          (description.value.trim().length < 30 && [description, "Açıklama en az 30 karakter olmalı."]) ||
          (phone.value.replace(/\D/g, "").length < 10 && [phone, "Lütfen geçerli bir telefon numarası yazın."]);
        if (problem) {
          problem[0].focus();
          return setStatus(status, problem[1], "error");
        }
        if (
          !images.length &&
          !confirm("Fotoğrafsız ilanlar çok daha az ilgi görür. Yine de fotoğrafsız gönderilsin mi?")
        )
          return;
        submit.disabled = true;
        setStatus(status, "Gönderiliyor…");
        const body = {
          title: title.value,
          category: category.value,
          events: [...events],
          city: city.value,
          district: district.value,
          description: description.value,
          priceMin: price.value,
          priceNote: priceNote.value,
          phone: phone.value,
          whatsapp: whatsapp.checked,
          instagram: instagram.value,
          showCalendar: showCalendar.checked,
          images,
          ...(picker ? picker.value() : {}),
        };
        try {
          if (id) {
            await api(`/api/account/listings/${id}`, { method: "PUT", body });
            await refreshMe();
            toast("Değişiklikler kaydedildi, ilan tekrar onaya gönderildi.", "success");
            return go("ilanlarim");
          }
          const { order } = await api("/api/account/listings", { method: "POST", body });
          await refreshMe();
          go("ilanlarim");
          if (order.status === "awaiting") {
            const dialog = openDialog(
              "İlanınız alındı",
              h("p", { class: "dialog-lead" }, "Ödemeniz onaylandıktan sonra ilanınız kontrol edilip yayına alınacak."),
              paymentInfo(order),
              h(
                "div",
                { class: "dialog-actions" },
                h("button", { type: "button", class: "btn btn-primary", onclick: () => dialog.close() }, "Tamam"),
              ),
            );
          } else {
            toast("İlanınız alındı! Kontrol edildikten sonra yayına girecek.", "success");
          }
        } catch (err) {
          setStatus(status, err.message, "error");
          submit.disabled = false;
        }
      },
    },
    h(
      "datalist",
      { id: "price-notes" },
      PRICE_NOTES.map((n) => h("option", { value: n })),
    ),
    h(
      "section",
      { class: "panel" },
      h("h2", {}, "İlan bilgileri"),
      h(
        "div",
        { class: "form-grid" },
        field("İlan başlığı", title, {
          wide: true,
          counter: true,
          help: "Hizmetinizi ve bölgenizi anlatan kısa bir başlık yazın.",
        }),
        field("Hizmet türü", category, { help: "İlan paketi fiyatı hizmet türüne göre belirlenir." }),
        h("div"),
        field("İl", city),
        field("İlçe", district, { help: "Tüm ilde hizmet veriyorsanız boş bırakın." }),
        h(
          "div",
          { class: "field field-full" },
          h("label", {}, "Hangi etkinlikler için hizmet veriyorsunuz?"),
          eventChips,
        ),
        field("Açıklama", description, {
          wide: true,
          counter: true,
          help: "Paragrafları boş satırla ayırabilirsiniz.",
        }),
      ),
    ),
    h(
      "section",
      { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", {}, "Fotoğraflar"), photoStatus),
      h(
        "p",
        { class: "panel-lead" },
        "En fazla 12 fotoğraf. İlk fotoğraf ilanın kapağı olur; okları kullanarak sıralayabilirsiniz. Yalnızca size ait fotoğrafları kullanın.",
      ),
      gallery,
    ),
    h(
      "section",
      { class: "panel" },
      h("h2", {}, "Fiyat ve iletişim"),
      h(
        "div",
        { class: "form-grid" },
        field("Hizmet fiyatı (₺)", price, { help: 'Boş bırakırsanız "Fiyat sorunuz" yazar.' }),
        field("Fiyat notu", priceNote),
        field("Telefon", phone, { help: 'Telefonunu doğrulayan ziyaretçiler "Hemen Ara" ile görür.' }),
        field("Instagram (isteğe bağlı)", instagram),
        h(
          "label",
          { class: "check field-full" },
          whatsapp,
          h("span", {}, "Bu numara WhatsApp'ta kullanılıyor (ilanda WhatsApp butonu çıkar)"),
        ),
        h(
          "label",
          { class: "check field-full" },
          showCalendar,
          h("span", {}, "Takvimimdeki dolu günleri ilanda göster (müşteri bilgileri gösterilmez)"),
        ),
      ),
    ),
    picker
      ? h(
          "section",
          { class: "panel" },
          h("h2", {}, "İlan paketi"),
          h(
            "p",
            { class: "panel-lead" },
            "İlanınız seçtiğiniz süre boyunca yayında kalır. Süre, ilan onaylandığı gün başlar.",
          ),
          picker.el,
        )
      : null,
    h(
      "div",
      { class: "editor-foot" },
      status,
      h(
        "p",
        { class: "editor-note" },
        ic("shield"),
        id
          ? "Düzenlenen ilanlar yeniden kontrol edildikten sonra yayına girer."
          : "İlanınız kontrol edildikten sonra yayına girer.",
      ),
      h("div", { class: "editor-actions" }, h("a", { class: "btn btn-ghost", href: "#ilanlarim" }, "Vazgeç"), submit),
    ),
  );
  fill(view, h("h2", { class: "acc-title" }, id ? "İlanı düzenle" : "Yeni ilan"), form);
  if (!id) title.focus();
}

/* ---------- Ödemeler ---------- */

async function renderOrders(view) {
  document.title = `Ödemeler | ${state.siteName}`;
  fill(view, h("h2", { class: "acc-title" }, "Ödemeler"), h("p", { class: "loading" }, "Yükleniyor…"));
  const { orders } = await api("/api/account/orders");
  const STATUS = { awaiting: ["Ödeme bekleniyor", "warn"], paid: ["Ödendi", "ok"], cancelled: ["İptal", "muted"] };
  const awaiting = orders.filter((o) => o.status === "awaiting");
  fill(
    view,
    h("h2", { class: "acc-title" }, "Ödemeler"),
    awaiting.length
      ? h(
          "div",
          { class: "pay-list" },
          awaiting.map((o) =>
            h("section", { class: "panel" }, h("h3", {}, o.label, " · ", o.listingTitle), paymentInfo(o)),
          ),
        )
      : null,
    orders.length
      ? h(
          "div",
          { class: "panel table-wrap" },
          h(
            "table",
            { class: "table" },
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                ["Sipariş", "Tarih", "Ürün", "İlan", "Tutar", "Durum"].map((t) => h("th", {}, t)),
              ),
            ),
            h(
              "tbody",
              {},
              orders.map((o) =>
                h(
                  "tr",
                  {},
                  h("td", {}, o.no),
                  h("td", {}, fmtDay(o.createdAt)),
                  h("td", {}, o.label, o.promo ? h("small", { class: "muted" }, ` (${o.promo})`) : null),
                  h("td", {}, o.listingTitle),
                  h("td", {}, o.amount ? fmtPrice(o.amount) : "Ücretsiz"),
                  h("td", {}, h("span", { class: `status status-${STATUS[o.status][1]}` }, STATUS[o.status][0])),
                ),
              ),
            ),
          ),
        )
      : h(
          "div",
          { class: "empty-state is-compact" },
          h("span", { class: "empty-icon" }, ic("wallet")),
          h("h2", {}, "Henüz siparişiniz yok"),
          h("p", {}, "İlan paketleri ve dopingler burada listelenir."),
        ),
  );
}

/* ---------- Teklif talepleri ---------- */

const REQUEST_STATUSES = { new: "Yeni", contacted: "Görüşüldü", won: "Anlaşıldı", lost: "Olmadı" };
const REQUEST_TONE = { new: "warn", contacted: "accent", won: "ok", lost: "muted" };

async function renderRequests(view) {
  document.title = `Talepler | ${state.siteName}`;
  fill(view, h("h2", { class: "acc-title" }, "Teklif talepleri"), h("p", { class: "loading" }, "Yükleniyor…"));
  let requests = (await api("/api/account/requests")).requests;
  let filter = "all";
  const list = h("div", { class: "rq-list" });
  const chips = h("div", { class: "acc-counts" });

  const syncBadge = () => {
    state.newRequests = requests.filter((r) => r.status === "new").length;
    const tab = document.querySelector('.acc-tab[href="#talepler"]');
    tab?.querySelector(".tab-badge")?.remove();
    if (tab && state.newRequests) tab.append(h("b", { class: "tab-badge" }, String(state.newRequests)));
  };

  const save = async (r, changes) => {
    const { request } = await api(`/api/account/requests/${r.id}`, { method: "PUT", body: changes });
    requests = requests.map((x) => (x.id === r.id ? request : x));
    syncBadge();
    render();
  };
  // Müşteri arandığında talep "Görüşüldü" olarak işaretlenir.
  const contacted = (r) => r.status === "new" && save(r, { status: "contacted" }).catch(() => {});

  const card = (r) => {
    const event = state.events.find((e) => e.id === r.event);
    const wa = `https://wa.me/${r.mobile}?text=${encodeURIComponent(
      `Merhaba ${r.name}, ${state.siteName} üzerinden "${r.listingTitle}" için gönderdiğiniz teklif talebiyle ilgili yazıyorum.`,
    )}`;
    const note = h("textarea", {
      rows: 2,
      maxlength: 1000,
      value: r.note || "",
      placeholder: "Yalnızca sizin göreceğiniz not (fiyat, görüşme özeti…)",
      onchange: () => save(r, { note: note.value }).then(() => toast("Not kaydedildi.", "success")),
    });
    return h(
      "article",
      { class: `panel rq-card${r.status === "new" ? " is-new" : ""}` },
      h(
        "header",
        { class: "rq-head" },
        h(
          "div",
          {},
          h("strong", {}, r.name),
          r.phoneVerified ? h("span", { class: "verified" }, ic("check"), "Doğrulanmış numara") : null,
          h("small", { class: "muted" }, fmtDate(r.createdAt)),
        ),
        h("span", { class: `status status-${REQUEST_TONE[r.status]}` }, REQUEST_STATUSES[r.status]),
      ),
      h(
        "a",
        { class: "rq-listing", href: r.listingPath, target: "_blank" },
        ic("image"),
        state.listings.find((l) => l.id === r.listingId)?.title || r.listingTitle,
      ),
      h(
        "ul",
        { class: "rq-facts" },
        h("li", {}, ic("calendar"), r.eventDate ? fmtDay(r.eventDate) : "Tarih belirtilmedi"),
        r.guests ? h("li", {}, ic("user"), `${r.guests.toLocaleString("tr-TR")} kişi`) : null,
        event ? h("li", {}, ic(event.icon), event.name) : null,
      ),
      h("p", { class: "rq-message" }, r.message),
      h(
        "div",
        { class: "rq-actions" },
        h(
          "a",
          { class: "btn btn-action btn-sm", href: `tel:+${r.mobile}`, onclick: () => contacted(r) },
          ic("phone"),
          r.phone,
        ),
        h(
          "a",
          {
            class: "btn btn-whatsapp btn-sm",
            href: wa,
            target: "_blank",
            rel: "noopener",
            onclick: () => contacted(r),
          },
          ic("whatsapp"),
          "WhatsApp",
        ),
        h(
          "select",
          {
            class: "rq-status",
            "aria-label": "Talep durumu",
            onchange: (e) => save(r, { status: e.target.value }),
          },
          Object.entries(REQUEST_STATUSES).map(([k, v]) => h("option", { value: k, selected: k === r.status }, v)),
        ),
        h(
          "button",
          {
            type: "button",
            class: "btn btn-light btn-sm",
            onclick: () => {
              const event = state.events.find((e) => e.id === r.event);
              state.bookingDraft = {
                clientName: r.name,
                clientPhone: r.phone,
                eventDate: r.eventDate || isoDate(new Date()),
                listingId: r.listingId,
                status: "option",
                note: [event?.name, r.guests ? `${r.guests} kişi` : "", r.message].filter(Boolean).join(" · "),
              };
              go("takvim");
            },
          },
          ic("calendar"),
          "Takvime ekle",
        ),
      ),
      h("label", { class: "rq-note" }, h("span", {}, "Notunuz"), note),
      h(
        "div",
        { class: "rq-foot" },
        h(
          "button",
          {
            type: "button",
            class: "link-btn",
            onclick: () => {
              state.blacklistPhone = r.phone;
              go("takvim");
            },
          },
          ic("ban"),
          "Kötü niyetli müşteri olarak bildir",
        ),
        h(
          "button",
          {
            type: "button",
            class: "link-btn danger",
            onclick: async () => {
              if (!confirm(`${r.name} adlı kişinin talebi silinsin mi?`)) return;
              await api(`/api/account/requests/${r.id}`, { method: "DELETE" });
              requests = requests.filter((x) => x.id !== r.id);
              syncBadge();
              render();
            },
          },
          "Sil",
        ),
      ),
    );
  };

  function render() {
    const counts = { all: requests.length };
    for (const r of requests) counts[r.status] = (counts[r.status] || 0) + 1;
    fill(
      chips,
      [["all", "Tümü"], ...Object.entries(REQUEST_STATUSES)].map(([key, label]) =>
        h(
          "button",
          {
            type: "button",
            class: `chip${filter === key ? " is-active" : ""}`,
            "aria-pressed": String(filter === key),
            onclick: () => {
              filter = key;
              render();
            },
          },
          `${label} (${counts[key] || 0})`,
        ),
      ),
    );
    const shown = requests.filter((r) => filter === "all" || r.status === filter);
    fill(
      list,
      shown.length
        ? shown.map(card)
        : h(
            "div",
            { class: "empty-state is-compact" },
            h("span", { class: "empty-icon" }, ic("mail")),
            h("h2", {}, requests.length ? "Bu durumda talep yok" : "Henüz teklif talebi yok"),
            h(
              "p",
              {},
              "Ziyaretçiler ilanınızdaki “Teklif İste” butonuyla tarih, kişi sayısı ve ayrıntıları gönderir; talepler burada listelenir.",
            ),
          ),
    );
  }

  render();
  fill(
    view,
    h("div", { class: "acc-toolbar" }, h("h2", { class: "acc-title" }, "Teklif talepleri"), chips),
    h(
      "p",
      { class: "panel-lead rq-lead" },
      "Müşteriyi aradığınızda talep “Görüşüldü” olarak işaretlenir. Anlaştığınız işi “Takvime ekle” ile randevu takviminize aktarın.",
    ),
    list,
  );
}

/* ---------- Takvim (CRM) ---------- */

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const BOOKING_TONE = { confirmed: "ok", cancelled: "muted", done: "accent", option: "warn" };

async function renderCalendar(view) {
  document.title = `Takvim | ${state.siteName}`;
  let bookings = (await api("/api/account/bookings")).bookings;
  const month = new Date();
  month.setDate(1);
  let selectedDay = isoDate(new Date());

  const calendarEl = h("div", { class: "crm-cal" });
  const dayEl = h("div", { class: "crm-day" });
  const upcomingEl = h("div", { class: "crm-upcoming" });

  const reload = async () => {
    bookings = (await api("/api/account/bookings")).bookings;
    render();
  };

  const bookingRow = (b) =>
    h(
      "article",
      { class: "booking" },
      h(
        "div",
        { class: "booking-main" },
        h("strong", {}, b.clientName),
        h("span", {}, [fmtDay(b.eventDate), b.eventTime, b.location].filter(Boolean).join(" · ")),
        h(
          "span",
          { class: "muted" },
          [
            b.clientPhone,
            b.totalAmount ? `Toplam ${fmtPrice(b.totalAmount)}` : "",
            b.deposit ? `Kapora ${fmtPrice(b.deposit)}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
      h("span", { class: `status status-${BOOKING_TONE[b.status]}` }, BOOKING_STATUSES[b.status]),
      h("button", { type: "button", class: "btn btn-light btn-sm", onclick: () => bookingDialog(b) }, "Düzenle"),
    );

  function render() {
    const first = new Date(month);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const byDay = {};
    for (const b of bookings) if (b.status !== "cancelled") (byDay[b.eventDate] ||= []).push(b);
    const today = isoDate(new Date());
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(h("span", { class: "cal-cell is-empty" }));
    for (let d = 1; d <= days; d++) {
      const key = isoDate(new Date(first.getFullYear(), first.getMonth(), d));
      const list = byDay[key] || [];
      const cls = [
        "cal-cell",
        list.length && "has-booking",
        list.length > 1 && "is-double",
        key === today && "is-today",
        key === selectedDay && "is-selected",
      ];
      cells.push(
        h(
          "button",
          {
            type: "button",
            class: cls.filter(Boolean).join(" "),
            onclick: () => {
              selectedDay = key;
              render();
            },
            "aria-label": `${d}${list.length ? ` (${list.length} kayıt)` : ""}`,
          },
          String(d),
          list.length
            ? h(
                "span",
                { class: "cal-dots" },
                list.slice(0, 3).map(() => h("i")),
              )
            : null,
        ),
      );
    }
    const shift = (n) => {
      month.setMonth(month.getMonth() + n);
      render();
    };
    fill(
      calendarEl,
      h(
        "div",
        { class: "crm-cal-head" },
        h(
          "button",
          { type: "button", class: "icon-btn", "aria-label": "Önceki ay", onclick: () => shift(-1) },
          ic("chevron", "icon rot-left"),
        ),
        h("h3", {}, first.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })),
        h(
          "button",
          { type: "button", class: "icon-btn", "aria-label": "Sonraki ay", onclick: () => shift(1) },
          ic("chevron"),
        ),
      ),
      h(
        "div",
        { class: "cal-grid" },
        ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"].map((w) => h("span", { class: "cal-head" }, w)),
        cells,
      ),
      h(
        "p",
        { class: "cal-legend" },
        h("i", { class: "dot-one" }),
        "Kayıt var ",
        h("i", { class: "dot-two" }),
        "Aynı gün birden fazla kayıt",
      ),
    );
    const dayList = bookings.filter((b) => b.eventDate === selectedDay);
    fill(
      dayEl,
      h(
        "div",
        { class: "panel-head" },
        h("h3", {}, fmtDay(selectedDay)),
        h(
          "button",
          { type: "button", class: "btn btn-action btn-sm", onclick: () => bookingDialog({ eventDate: selectedDay }) },
          ic("plus"),
          "Kayıt ekle",
        ),
      ),
      dayList.length ? dayList.map(bookingRow) : h("p", { class: "muted" }, "Bu güne kayıt yok."),
    );
    const upcoming = bookings.filter((b) => b.eventDate >= today && b.status !== "cancelled").slice(0, 8);
    fill(
      upcomingEl,
      h("h3", {}, "Yaklaşan işler"),
      upcoming.length ? upcoming.map(bookingRow) : h("p", { class: "muted" }, "Yaklaşan kayıt yok."),
    );
  }

  function bookingDialog(b) {
    const status = statusLine();
    const form = h(
      "form",
      { class: "form-grid", novalidate: true },
      field(
        "Müşteri adı",
        h("input", { name: "clientName", value: b.clientName || "", maxlength: 80, required: true }),
      ),
      field(
        "Müşteri telefonu",
        h("input", { name: "clientPhone", type: "tel", value: b.clientPhone || "", placeholder: "05xx xxx xx xx" }),
      ),
      field("Tarih", h("input", { name: "eventDate", type: "date", value: b.eventDate || "", required: true })),
      field("Saat", h("input", { name: "eventTime", type: "time", value: b.eventTime || "" })),
      field("Adres / mekân", h("input", { name: "location", value: b.location || "", maxlength: 160 }), { wide: true }),
      field(
        "İlan",
        h(
          "select",
          { name: "listingId" },
          h("option", { value: "" }, "Seçilmedi"),
          state.listings.map((l) => h("option", { value: l.id, selected: l.id === b.listingId }, l.title)),
        ),
      ),
      field(
        "Durum",
        h(
          "select",
          { name: "status" },
          Object.entries(BOOKING_STATUSES).map(([k, v]) =>
            h("option", { value: k, selected: k === (b.status || "option") }, v),
          ),
        ),
      ),
      field("Toplam tutar (₺)", h("input", { name: "totalAmount", inputmode: "numeric", value: b.totalAmount || "" })),
      field("Alınan kapora (₺)", h("input", { name: "deposit", inputmode: "numeric", value: b.deposit || "" })),
      field("Not", h("textarea", { name: "note", rows: 2, maxlength: 1000, value: b.note || "" }), { wide: true }),
    );
    const save = async (force = false) => {
      const body = { ...Object.fromEntries(new FormData(form)), force };
      try {
        const result = await api(b.id ? `/api/account/bookings/${b.id}` : "/api/account/bookings", {
          method: b.id ? "PUT" : "POST",
          body,
        });
        if (result.warning) {
          toast(
            result.warning.blocked
              ? "Dikkat: Bu müşteri numarası kara listede (engellenmiş)."
              : `Dikkat: Bu numara hakkında ${result.warning.reports} kötü niyet ihbarı var.`,
            "error",
          );
        } else toast("Kayıt kaydedildi.", "success");
        dialog.close();
        selectedDay = body.eventDate;
        await reload();
      } catch (err) {
        if (
          err.status === 409 &&
          confirm("Bu tarihte başka bir kaydınız var (çifte rezervasyon). Yine de kaydedilsin mi?")
        )
          return save(true);
        setStatus(status, err.message, "error");
      }
    };
    const dialog = openDialog(
      b.id ? "Kaydı düzenle" : "Yeni kayıt",
      form,
      status,
      h(
        "div",
        { class: "dialog-actions" },
        b.id
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn-ghost danger",
                onclick: async () => {
                  if (!confirm("Kayıt silinsin mi?")) return;
                  await api(`/api/account/bookings/${b.id}`, { method: "DELETE" });
                  dialog.close();
                  await reload();
                },
              },
              "Sil",
            )
          : null,
        h("button", { type: "button", class: "btn btn-primary", onclick: () => save() }, "Kaydet"),
      ),
    );
  }

  // Kara liste bildirimi
  const blStatus = statusLine();
  const blForm = h(
    "form",
    {
      class: "panel",
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const result = await api("/api/account/blacklist", {
            method: "POST",
            body: Object.fromEntries(new FormData(blForm)),
          });
          blForm.reset();
          setStatus(
            blStatus,
            result.blocked ? "Bildiriminiz alındı. Bu numara artık engellendi." : "Bildiriminiz alındı. Teşekkürler.",
            "success",
          );
        } catch (err) {
          setStatus(blStatus, err.message, "error");
        }
      },
    },
    h("h2", {}, "Kötü niyetli müşteri bildir"),
    h(
      "p",
      { class: "panel-lead" },
      "Asılsız adres veren ya da kapıda iptal eden müşterileri bildirin. Farklı organizatörlerden 2 ihbar alan numara kalıcı olarak engellenir ve iletişim bilgilerini göremez.",
    ),
    h(
      "div",
      { class: "form-grid" },
      field(
        "Müşteri telefonu",
        h("input", { name: "phone", type: "tel", required: true, placeholder: "05xx xxx xx xx" }),
      ),
      field(
        "Neden",
        h(
          "select",
          { name: "reason" },
          Object.entries(BLACKLIST_REASONS).map(([k, v]) => h("option", { value: k }, v)),
        ),
      ),
      field("Açıklama (isteğe bağlı)", h("textarea", { name: "note", rows: 2, maxlength: 500 }), { wide: true }),
    ),
    blStatus,
    h("div", { class: "panel-actions" }, h("button", { class: "btn btn-light", type: "submit" }, "Bildir")),
  );

  // "Talepler"den gelen kayıt taslağı: ilgili ay açılır ve form doldurulmuş gelir.
  const draft = state.bookingDraft;
  state.bookingDraft = null;
  if (draft?.eventDate) {
    const [y, m] = draft.eventDate.split("-").map(Number);
    month.setFullYear(y, m - 1, 1);
    selectedDay = draft.eventDate;
  }

  render();
  fill(
    view,
    h(
      "div",
      { class: "acc-toolbar" },
      h("h2", { class: "acc-title" }, "Randevu takvimi"),
      h(
        "button",
        { type: "button", class: "btn btn-action", onclick: () => bookingDialog({ eventDate: selectedDay }) },
        ic("plus"),
        "Yeni kayıt",
      ),
    ),
    h(
      "div",
      { class: "crm-layout" },
      h("section", { class: "panel" }, calendarEl),
      h("section", { class: "panel" }, dayEl),
    ),
    h("section", { class: "panel" }, upcomingEl),
    blForm,
  );
  if (draft) bookingDialog(draft);
  if (state.blacklistPhone) {
    blForm.phone.value = state.blacklistPhone;
    state.blacklistPhone = "";
    blForm.scrollIntoView({ behavior: "smooth", block: "center" });
    blForm.reason.focus();
  }
}

/* ---------- Profil ---------- */

function verifyPanel(u) {
  const vStatus = statusLine();
  const phone = h("input", { type: "tel", value: u.phone, inputmode: "tel" });
  const code = h("input", { inputmode: "numeric", maxlength: 6, placeholder: "••••••", autocomplete: "one-time-code" });
  const codeField = field("SMS kodu", code);
  codeField.hidden = true;
  const button = h(
    "button",
    {
      type: "button",
      class: "btn btn-light",
      onclick: async () => {
        button.disabled = true;
        try {
          if (codeField.hidden) {
            const { sentTo } = await api("/api/v1/auth/send-otp", { method: "POST", body: { phone: phone.value } });
            codeField.hidden = false;
            button.textContent = "Doğrula";
            setStatus(vStatus, `${sentTo} numarasına kod gönderdik.`, "success");
            code.focus();
          } else {
            await api("/api/v1/auth/verify-otp", { method: "POST", body: { phone: phone.value, code: code.value } });
            await refreshMe();
            toast("Telefonunuz doğrulandı, hesabınız artık onaylı!", "success");
            route();
          }
        } catch (err) {
          setStatus(vStatus, err.message, "error");
        } finally {
          button.disabled = false;
        }
      },
    },
    "Kod gönder",
  );
  return h(
    "section",
    { class: "panel" },
    h("h2", {}, "Hesabınızı onaylayın"),
    h(
      "p",
      { class: "panel-lead" },
      'Telefonunuzu SMS koduyla doğrulayın; ilanlarınızda yeşil "Onaylı hesap" rozeti görünsün. Şifrenizi unutursanız bu numarayla sıfırlayabilirsiniz.',
    ),
    h("div", { class: "form-grid" }, field("Cep telefonu", phone), codeField),
    vStatus,
    h("div", { class: "panel-actions" }, button),
  );
}

function renderProfile(view) {
  document.title = `Profil | ${state.siteName}`;
  const u = state.user;

  const profileStatus = statusLine();
  const profile = h(
    "form",
    {
      class: "panel",
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const { user } = await api("/api/account/profile", {
            method: "PUT",
            body: Object.fromEntries(new FormData(profile)),
          });
          state.user = user;
          toast("Bilgileriniz güncellendi.", "success");
          route();
        } catch (err) {
          setStatus(profileStatus, err.message, "error");
        }
      },
    },
    h("h2", {}, "Firma bilgileri"),
    h(
      "div",
      { class: "form-grid" },
      field("Firma / marka adı", h("input", { name: "company", value: u.company, maxlength: 80, required: true }), {
        help: "Değiştirirseniz tüm ilanlarınızda güncellenir.",
      }),
      field("Ad soyad", h("input", { name: "name", value: u.name, maxlength: 80, required: true })),
      field("Telefon", h("input", { name: "phone", type: "tel", value: u.phone, required: true })),
      field("E-posta", h("input", { value: u.email, disabled: true }), {
        help: "E-posta adresini değiştirmek için bizimle iletişime geçin.",
      }),
      field("T.C. / vergi no", h("input", { value: u.tcVkn, disabled: true })),
    ),
    profileStatus,
    h("div", { class: "panel-actions" }, h("button", { class: "btn btn-primary", type: "submit" }, "Kaydet")),
  );

  const pwStatus = statusLine();
  const current = passwordInput("current", "current-password", "");
  const next = passwordInput("next", "new-password", "En az 8 karakter");
  const password = h(
    "form",
    {
      class: "panel",
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          await api("/api/account/password", {
            method: "POST",
            body: { current: current.input.value, next: next.input.value },
          });
          password.reset();
          setStatus(pwStatus, "Şifreniz değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı.", "success");
        } catch (err) {
          setStatus(pwStatus, err.message, "error");
        }
      },
    },
    h("h2", {}, "Şifre değiştir"),
    h("div", { class: "form-grid" }, field("Mevcut şifre", current.wrap), field("Yeni şifre", next.wrap)),
    pwStatus,
    h("div", { class: "panel-actions" }, h("button", { class: "btn btn-light", type: "submit" }, "Şifreyi değiştir")),
  );

  const remove = h(
    "section",
    { class: "panel panel-danger" },
    h("h2", {}, "Hesabı sil"),
    h(
      "p",
      { class: "panel-lead" },
      "Hesabınız, tüm ilanlarınız, fotoğraflarınız ve takvim kayıtlarınız kalıcı olarak silinir. Bu işlem geri alınamaz.",
    ),
    h(
      "button",
      {
        type: "button",
        class: "btn btn-light danger",
        onclick: async () => {
          const pw = prompt("Hesabınızı silmek için şifrenizi yazın:");
          if (!pw) return;
          try {
            await api("/api/account", { method: "DELETE", body: { password: pw } });
            state.user = null;
            toast("Hesabınız silindi.");
            go("giris");
          } catch (err) {
            toast(err.message, "error");
          }
        },
      },
      "Hesabımı sil",
    ),
  );

  fill(
    view,
    h("h2", { class: "acc-title" }, "Profil"),
    u.phoneVerified ? null : verifyPanel(u),
    profile,
    password,
    remove,
  );
}

/* ---------- Yönlendirme ---------- */

function route() {
  const [page, param] = location.hash.slice(1).split("/");
  window.scrollTo(0, 0);
  if (!state.user) {
    if (page === "yeni-ilan") state.returnTo = "yeni-ilan";
    if (page === "sifre") return renderReset();
    return renderAuth(page === "kayit" ? "register" : "login");
  }
  if (!isOrganizer()) return page === "kayit" ? renderAuth("register") : renderClient();
  if (page === "giris" || page === "kayit" || !page) return go("ilanlarim");
  const view = shell(page === "duzenle" ? "ilanlarim" : page);
  const failed = (err) =>
    fill(view, h("div", { class: "empty-state is-compact" }, h("h2", {}, "Bir sorun oluştu"), h("p", {}, err.message)));
  if (page === "yeni-ilan") return renderEditor(view);
  if (page === "duzenle") return renderEditor(view, param);
  if (page === "odemeler") return renderOrders(view).catch(failed);
  if (page === "takvim") return renderCalendar(view).catch(failed);
  if (page === "talepler") return renderRequests(view).catch(failed);
  if (page === "profil") return renderProfile(view);
  // Önce eldeki veriyle çiz, ardından onay/ödeme durumlarını sunucudan tazele.
  renderListings(view);
  refreshMe()
    .then(() => view.isConnected && renderListings(view))
    .catch(() => {});
}

window.addEventListener("hashchange", route);

(async () => {
  try {
    const meta = await api("/api/v1/meta");
    state.categories = meta.categories;
    state.events = meta.events;
    state.pricing = meta.pricing;
    try {
      await refreshMe();
    } catch (err) {
      if (err.status !== 401) throw err;
    }
    route();
  } catch (err) {
    fill(
      app,
      h(
        "div",
        { class: "empty-state" },
        h("h2", {}, "Bir sorun oluştu"),
        h("p", {}, err.message),
        h("a", { class: "btn btn-light", href: "/hesap/" }, "Tekrar dene"),
      ),
    );
  }
})();
