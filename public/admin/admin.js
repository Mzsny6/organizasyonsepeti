// Yönetim paneli: moderasyon (ilanlar, ödemeler, promosyonlar, üyeler, kara liste, şikâyetler, mesajlar)
// ve site içeriği/ayarları.
import { ICONS } from "/assets/js/icons.js";
import { renderAnalytics } from "/admin/analytics.js";
import {
  api,
  fill,
  fmtDate,
  fmtDay,
  fmtPrice,
  fmtSize,
  h,
  ic,
  pickFiles,
  setUnauthorizedHandler,
  thumbUrl,
  toast,
  uploadImage,
} from "/assets/js/ui.js";

setUnauthorizedHandler(() => showLogin("Oturumunuz sona erdi, lütfen tekrar giriş yapın."));

/* ============================================================
   Durum
   ============================================================ */

const state = {
  content: null,
  savedJson: "",
  messages: [],
  summary: null,
  page: "panel",
  saving: false,
};

const isDirty = () => state.content && JSON.stringify(state.content) !== state.savedJson;

function markDirty() {
  document.body.classList.toggle("is-dirty", isDirty());
}

const newId = () => Math.random().toString(16).slice(2, 12).padEnd(10, "0");
const clone = (v) => structuredClone(v);
const nowIso = () => new Date().toISOString();

const TEMPLATES = {
  categories: { slug: "", name: "", icon: "sparkles", tier: 3 },
  events: { slug: "", name: "", icon: "party" },
  steps: { title: "", text: "" },
  faq: { q: "", a: "" },
};

const PACKAGE_LABELS = { "": "Tüm paketler", monthly: "1 Aylık", quarterly: "3 Aylık", yearly: "Yıllık" };
const DOPING_LABELS = {
  showcase: "Ana Sayfa Vitrini",
  categoryTop: "Kategori Üst Sıra",
  highlight: "Renkli Çerçeve & Rozet",
};
const REPORT_REASONS = {
  yaniltici: "Yanıltıcı ya da yanlış bilgi",
  dolandiricilik: "Dolandırıcılık şüphesi",
  uygunsuz: "Uygunsuz içerik",
  kopya: "Başkasına ait fotoğraf veya kopya ilan",
  diger: "Diğer",
};
const BLACKLIST_REASONS = {
  "sahte-adres": "Asılsız ya da yanlış adres verdi",
  "kapida-iptal": "Adrese gidildiğinde iptal etti",
  "odeme-yapmadi": "Hizmet sonrası ödeme yapmadı",
  diger: "Diğer kötü niyetli davranış",
};

async function loadSummary() {
  try {
    state.summary = await api("/api/admin/summary");
  } catch {
    /* panel yine de açılır */
  }
  renderNav();
}

/* ============================================================
   Medya seçici
   ============================================================ */

async function openMediaPicker() {
  const { items } = await api("/api/media");
  return new Promise((resolve) => {
    const close = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const dialog = h(
      "dialog",
      { class: "modal", onclose: () => resolve(null) },
      h(
        "div",
        { class: "modal-head" },
        h("h3", {}, "Medya kütüphanesi"),
        h(
          "button",
          { class: "icon-btn", type: "button", "aria-label": "Kapat", onclick: () => close(null) },
          ic("close"),
        ),
      ),
      items.length
        ? h(
            "div",
            { class: "media-grid picker" },
            items.map((item) =>
              h(
                "button",
                { type: "button", class: "media-pick", onclick: () => close(item.url) },
                h("img", { src: item.url, alt: item.name || "", loading: "lazy" }),
              ),
            ),
          )
        : h("p", { class: "empty" }, "Henüz yüklenmiş görsel yok."),
    );
    document.body.append(dialog);
    dialog.showModal();
  });
}

/* ============================================================
   Form alanları
   ============================================================ */

let uid = 0;

function setValue(obj, key, value) {
  obj[key] = value;
  markDirty();
}

function field(obj, def) {
  const id = `f${++uid}`;
  const control = (() => {
    switch (def.type) {
      case "textarea":
        return h("textarea", {
          id,
          rows: def.rows || 4,
          value: obj[def.key] ?? "",
          placeholder: def.placeholder,
          oninput: (e) => setValue(obj, def.key, e.target.value),
        });
      case "select":
        return h(
          "select",
          { id, onchange: (e) => setValue(obj, def.key, def.number ? Number(e.target.value) : e.target.value) },
          def.options.map(([value, label]) =>
            h("option", { value, selected: String(obj[def.key]) === String(value) }, label),
          ),
        );
      case "toggle":
        return h(
          "label",
          { class: "switch" },
          h("input", {
            id,
            type: "checkbox",
            checked: Boolean(obj[def.key]),
            onchange: (e) => setValue(obj, def.key, e.target.checked),
          }),
          h("span", { class: "switch-ui" }),
          h("span", {}, def.toggleLabel || "Açık"),
        );
      case "icon":
        return iconPicker(obj, def);
      case "image":
        return imageField(obj, def);
      case "list":
        return stringList(obj, def);
      case "number":
        return h("input", {
          id,
          type: "number",
          min: def.min ?? 0,
          max: def.max,
          step: def.step || 1,
          value: obj[def.key] ?? 0,
          oninput: (e) => setValue(obj, def.key, Number(e.target.value)),
        });
      default:
        return h("input", {
          id,
          type: def.inputType || "text",
          value: obj[def.key] ?? "",
          placeholder: def.placeholder,
          inputmode: def.inputmode,
          oninput: (e) => setValue(obj, def.key, e.target.value),
        });
    }
  })();
  const labelTag = ["text", "textarea", "select", "number", undefined].includes(def.type) ? "label" : "div";
  return h(
    "div",
    { class: `field${def.wide ? " is-wide" : ""}` },
    h(labelTag, { class: "field-label", for: labelTag === "label" ? id : null }, def.label),
    control,
    def.help && h("p", { class: "field-help" }, def.help),
  );
}

function iconPicker(obj, def) {
  const wrap = h("div", { class: "icon-picker", role: "radiogroup", "aria-label": def.label });
  const render = () =>
    fill(
      wrap,
      ...Object.entries(ICONS)
        .filter(([, v]) => !v.ui)
        .map(([name, v]) =>
          h(
            "button",
            {
              type: "button",
              class: `icon-option${obj[def.key] === name ? " is-active" : ""}`,
              title: v.label,
              role: "radio",
              "aria-checked": String(obj[def.key] === name),
              "aria-label": v.label,
              onclick: () => {
                setValue(obj, def.key, name);
                render();
              },
            },
            ic(name),
          ),
        ),
    );
  render();
  return wrap;
}

function imageField(obj, def) {
  const wrap = h("div", { class: "image-field" });
  const render = (busy = false) => {
    const url = obj[def.key];
    fill(
      wrap,
      h(
        "div",
        { class: `image-preview${url ? "" : " is-empty"}` },
        url ? h("img", { src: url, alt: "" }) : ic("camera"),
      ),
      h(
        "div",
        { class: "image-actions" },
        h(
          "button",
          {
            type: "button",
            class: "btn btn-light btn-sm",
            disabled: busy,
            onclick: async () => {
              const [file] = await pickFiles();
              if (!file) return;
              render(true);
              try {
                setValue(obj, def.key, await uploadImage(file));
                toast("Görsel yüklendi. Yayına almak için Kaydet'e basın.", "success");
              } catch (err) {
                toast(err.message, "error");
              }
              render();
            },
          },
          busy ? "Yükleniyor…" : url ? "Değiştir" : "Görsel yükle",
        ),
        h(
          "button",
          {
            type: "button",
            class: "btn btn-ghost btn-sm",
            disabled: busy,
            onclick: async () => {
              const picked = await openMediaPicker().catch((err) => toast(err.message, "error"));
              if (picked) {
                setValue(obj, def.key, picked);
                render();
              }
            },
          },
          "Kütüphaneden seç",
        ),
        url &&
          h(
            "button",
            {
              type: "button",
              class: "btn btn-ghost btn-sm danger",
              onclick: () => {
                setValue(obj, def.key, "");
                render();
              },
            },
            "Kaldır",
          ),
      ),
    );
  };
  render();
  return wrap;
}

function stringList(obj, def) {
  const wrap = h("div", { class: "string-list" });
  const render = (focusIndex) => {
    const list = obj[def.key];
    fill(
      wrap,
      ...list.map((value, i) =>
        h(
          "div",
          { class: "string-row" },
          h("input", {
            value,
            placeholder: def.placeholder,
            "aria-label": `${def.label} ${i + 1}`,
            oninput: (e) => {
              list[i] = e.target.value;
              markDirty();
            },
          }),
          h(
            "button",
            {
              type: "button",
              class: "icon-btn",
              "aria-label": "Sil",
              onclick: () => {
                list.splice(i, 1);
                markDirty();
                render();
              },
            },
            ic("close"),
          ),
        ),
      ),
      h(
        "button",
        {
          type: "button",
          class: "btn btn-ghost btn-sm",
          onclick: () => {
            list.push("");
            markDirty();
            render(list.length - 1);
          },
        },
        "+ Satır ekle",
      ),
    );
    if (focusIndex !== undefined) wrap.querySelectorAll("input")[focusIndex]?.focus();
  };
  render();
  return wrap;
}

const formGrid = (obj, fields) =>
  h(
    "div",
    { class: "form-grid" },
    fields.map((def) => field(obj, def)),
  );

function card(title, description, ...body) {
  return h(
    "section",
    { class: "card" },
    (title || description) &&
      h("header", { class: "card-head" }, title && h("h2", {}, title), description && h("p", {}, description)),
    ...body,
  );
}

const SECTION_FIELDS = [
  { key: "eyebrow", label: "Üst başlık", placeholder: "Örn. Hizmetlerimiz" },
  { key: "title", label: "Başlık" },
  { key: "text", label: "Açıklama", type: "textarea", rows: 2, wide: true },
];

// Sıralanabilir, açılır-kapanır kayıt listesi (hizmetler, paketler, SSS…)
function listEditor(key, { label, fields, titleOf, emptyText }) {
  const wrap = h("div", { class: "list-editor" });
  const items = state.content[key];

  const move = (from, to) => {
    if (to < 0 || to >= items.length) return;
    items.splice(to, 0, items.splice(from, 1)[0]);
    markDirty();
    render(items[to].id);
  };

  const render = (openId) => {
    fill(
      wrap,
      ...items.map((item, i) => {
        const title = h("span", { class: "item-title" }, titleOf(item) || `Yeni ${label.toLocaleLowerCase("tr")}`);
        const action = (iconName, aria, fn, cls = "") =>
          h(
            "button",
            {
              type: "button",
              class: `icon-btn ${cls}`,
              "aria-label": aria,
              title: aria,
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                fn();
              },
            },
            ic(iconName),
          );
        return h(
          "details",
          {
            class: "item",
            open: item.id === openId,
            oninput: () => (title.textContent = titleOf(item) || `Yeni ${label.toLocaleLowerCase("tr")}`),
          },
          h(
            "summary",
            {},
            h("span", { class: "item-num" }, i + 1),
            title,
            h(
              "span",
              { class: "item-actions" },
              action("chevron", "Yukarı taşı", () => move(i, i - 1), "rot-up"),
              action("chevron", "Aşağı taşı", () => move(i, i + 1), "rot-down"),
              action(
                "close",
                "Sil",
                () => {
                  if (!confirm(`"${titleOf(item) || label}" silinsin mi?`)) return;
                  items.splice(i, 1);
                  markDirty();
                  render();
                },
                "danger",
              ),
            ),
          ),
          h("div", { class: "item-body" }, formGrid(item, fields)),
        );
      }),
      items.length ? null : h("p", { class: "empty" }, emptyText || "Henüz kayıt yok."),
      h(
        "button",
        {
          type: "button",
          class: "btn btn-add",
          onclick: () => {
            const item = { id: newId(), ...clone(TEMPLATES[key]) };
            items.push(item);
            markDirty();
            render(item.id);
            wrap.querySelector("details[open] input, details[open] textarea")?.focus();
          },
        },
        `+ ${label} ekle`,
      ),
    );
  };
  render();
  return wrap;
}

/* ============================================================
   Sayfalar
   ============================================================ */

const NAV = [
  { id: "panel", title: "Genel bakış", icon: "sparkles" },
  { id: "ziyaretler", title: "Ziyaret istatistikleri", icon: "chart" },
  { group: "Moderasyon" },
  { id: "ilanlar", title: "İlanlar", icon: "image", badge: () => state.summary?.listings.pending },
  { id: "odemeler", title: "Ödemeler", icon: "wallet", badge: () => state.summary?.awaitingPayments },
  { id: "promosyonlar", title: "Promosyon kodları", icon: "tag" },
  { id: "uyeler", title: "Üyeler", icon: "user" },
  { id: "karaliste", title: "Kara liste", icon: "ban" },
  { id: "sikayetler", title: "Şikâyetler", icon: "flag", badge: () => state.summary?.reports },
  { id: "degerlendirmeler", title: "Değerlendirmeler", icon: "star", badge: () => state.summary?.pendingReviews },
  { id: "mesajlar", title: "Mesajlar", icon: "mail", badge: () => state.messages.filter((m) => !m.read).length },
  { group: "Site içeriği" },
  { id: "anasayfa", title: "Ana sayfa", icon: "star" },
  { id: "kategoriler", title: "Hizmet kategorileri", icon: "balloon" },
  { id: "etkinlikler", title: "Etkinlik türleri", icon: "party" },
  { id: "surec", title: "Nasıl çalışır", icon: "check" },
  { id: "sss", title: "Sıkça sorulanlar", icon: "flower" },
  { group: "Ayarlar" },
  { id: "fiyatlar", title: "Fiyatlandırma", icon: "wallet" },
  { id: "guvenlik", title: "Güvenlik & SMS", icon: "shield" },
  { id: "iletisim", title: "İletişim bilgileri", icon: "phone" },
  { id: "seo", title: "Marka & SEO", icon: "crown" },
  { id: "yasal", title: "Yasal metinler", icon: "flag" },
  { id: "medya", title: "Medya kütüphanesi", icon: "camera" },
  { id: "hesap", title: "Hesap & yedekler", icon: "clock" },
];

const statusChip = (label, tone) => h("span", { class: `chip chip-${tone}` }, label);
const loading = () => h("p", { class: "empty" }, "Yükleniyor…");
const categoryName = (id) => state.content.categories.find((c) => c.id === id)?.name || "—";

function tabs(items, current, onSelect) {
  return h(
    "div",
    { class: "tabs", role: "tablist" },
    items.map(([value, label, count]) =>
      h(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": String(current === value),
          class: current === value ? "is-active" : "",
          onclick: () => onSelect(value),
        },
        label,
        count !== undefined ? h("em", { class: "tab-count" }, count) : null,
      ),
    ),
  );
}

async function act(promise, success) {
  try {
    const result = await promise;
    if (success) toast(success, "success");
    loadSummary();
    return result;
  } catch (err) {
    if (err.status !== 401) toast(err.message, "error");
    throw err;
  }
}

/* ---------- Genel bakış ---------- */

function renderDashboard() {
  const box = h("div", { class: "page-body" }, loading());
  loadSummary().then(() => fill(box, dashboardBody()));
  return box;
}

function dashboardBody() {
  const s = state.summary;
  if (!s) return h("p", { class: "empty" }, "Özet yüklenemedi.");
  const c = state.content;
  const stat = (value, label, page, tone = "") =>
    h(
      "button",
      { type: "button", class: `stat${tone ? ` is-${tone}` : ""}`, onclick: () => go(page) },
      h("strong", {}, value),
      h("span", {}, label),
    );

  const notices = [];
  if (!s.sms.configured) {
    notices.push([
      "warn",
      "SMS sağlayıcısı bağlı değil. İletişim bariyeri kapalı: ziyaretçiler telefon doğrulaması yapmadan numaraları görür. Netgsm bilgilerini Netlify ortam değişkenlerine ekleyin (README).",
    ]);
  } else if (s.sms.testMode) {
    notices.push([
      "warn",
      "SMS test modunda: kodlar gönderilmiyor, sunucu kaydına yazılıyor. Canlı kullanımda SMS_TEST_MODE ayarını kaldırın.",
    ]);
  }
  if (c.pricing.freeMode) notices.push(["info", "Ücretsiz mod açık: tüm ilan paketleri ve dopingler ücretsiz."]);
  else if (!c.pricing.bank.iban)
    notices.push([
      "warn",
      "Havale/EFT için IBAN bilgisi girilmedi. Ücretli siparişlerde organizatörler ödeme bilgisini göremez → Fiyatlandırma.",
    ]);

  const tasks = [
    [Boolean(c.settings.phone || c.settings.email), "İletişim bilgilerini girin", "iletisim"],
    [Boolean(c.settings.instagram), "Instagram hesabını ekleyin", "iletisim"],
    [c.pricing.freeMode || Boolean(c.pricing.bank.iban), "Havale/EFT banka bilgilerini girin", "fiyatlar"],
    [s.sms.configured && !s.sms.testMode, "SMS sağlayıcısını (Netgsm) bağlayın", "guvenlik"],
    [Boolean(c.hero.image), "Ana sayfaya bir kapak fotoğrafı koyun", "anasayfa"],
    [false, "KVKK ve kullanım koşullarını bir hukukçuya kontrol ettirin", "yasal"],
  ];

  return [
    notices.length
      ? h(
          "div",
          { class: "notices" },
          notices.map(([tone, text]) => h("p", { class: `notice notice-${tone}` }, text)),
        )
      : null,
    h(
      "div",
      { class: "stats-row" },
      stat(s.today?.visitors || 0, "Bugünkü ziyaretçi", "ziyaretler"),
      stat(s.today?.views || 0, "Bugünkü sayfa görüntüleme", "ziyaretler"),
      stat((s.today?.events?.phone || 0) + (s.today?.events?.whatsapp || 0), "Bugün firmalara ulaşan", "ziyaretler"),
      stat(s.today?.events?.request || 0, "Bugünkü teklif talebi", "ziyaretler"),
      stat(s.listings.pending, "Onay bekleyen ilan", "ilanlar", s.listings.pending ? "alert" : ""),
      stat(s.awaitingPayments, "Ödeme bekleyen sipariş", "odemeler", s.awaitingPayments ? "alert" : ""),
      stat(s.reports, "Açık şikâyet", "sikayetler", s.reports ? "alert" : ""),
      stat(s.pendingReviews, "Onay bekleyen yorum", "degerlendirmeler", s.pendingReviews ? "alert" : ""),
      stat(s.unreadMessages, "Okunmamış mesaj", "mesajlar"),
      stat(s.listings.active, "Yayındaki ilan", "ilanlar"),
      stat(s.organizers, "Organizatör", "uyeler"),
      stat(s.clients, "Doğrulanmış ziyaretçi", "uyeler"),
      stat(fmtPrice(s.revenue) || "0 ₺", "Toplam tahsilat", "odemeler"),
    ),
    card(
      "Yapılacaklar",
      null,
      h(
        "ul",
        { class: "checklist" },
        tasks.map(([ok, text, page]) =>
          h(
            "li",
            { class: ok ? "is-done" : "" },
            h("button", { type: "button", onclick: () => go(page) }, ic(ok ? "check" : "chevron"), text),
          ),
        ),
      ),
    ),
  ];
}

/* ---------- İlanlar (moderasyon) ---------- */

let listingTab = "pending";
let listingQuery = "";
const paid = (x) => x.credit > 0 || (x.expiresAt && x.expiresAt > nowIso());
const LISTING_TABS = {
  pending: ["Onay bekleyen", (x) => x.status === "pending" && paid(x) && !x.awaitingOrder],
  payment: ["Ödeme bekleyen", (x) => x.status === "pending" && x.awaitingOrder],
  nopackage: ["Paketsiz", (x) => x.status === "pending" && !paid(x) && !x.awaitingOrder],
  live: ["Yayında", (x) => x.status === "active" && x.expiresAt > nowIso()],
  expired: ["Süresi dolan", (x) => x.status === "active" && !(x.expiresAt > nowIso())],
  rejected: ["Reddedilen", (x) => x.status === "rejected"],
  passive: ["Pasif", (x) => x.status === "passive"],
  all: ["Tümü", () => true],
};

function listingState(x) {
  for (const [key, [label, test]] of Object.entries(LISTING_TABS)) {
    if (key !== "all" && test(x))
      return [
        label,
        {
          pending: "alert",
          payment: "warn",
          nopackage: "warn",
          live: "ok",
          expired: "muted",
          rejected: "bad",
          passive: "muted",
        }[key],
      ];
  }
  return ["—", "muted"];
}

function renderListingsAdmin() {
  const wrap = h("div", { class: "page-body" }, loading());
  let listings = [];
  const load = async () => {
    listings = (await api("/api/admin/listings")).listings;
    draw();
  };

  function draw() {
    const q = listingQuery.toLocaleLowerCase("tr");
    const items = listings
      .filter(LISTING_TABS[listingTab][1])
      .filter((x) => !q || `${x.title} ${x.company} ${x.id}`.toLocaleLowerCase("tr").includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    fill(
      wrap,
      h(
        "div",
        { class: "toolbar" },
        tabs(
          Object.entries(LISTING_TABS).map(([k, [label, test]]) => [k, label, listings.filter(test).length]),
          listingTab,
          (v) => ((listingTab = v), draw()),
        ),
        h("input", {
          class: "search-input",
          type: "search",
          placeholder: "Başlık, firma ya da ilan no ara",
          value: listingQuery,
          oninput: (e) => {
            listingQuery = e.target.value;
            draw();
            wrap.querySelector(".search-input")?.focus();
          },
        }),
      ),
      items.length
        ? h(
            "div",
            { class: "mod-list" },
            items.map((x) => listingRow(x, load)),
          )
        : h("p", { class: "empty" }, "Bu bölümde ilan yok."),
    );
  }
  load().catch((err) => fill(wrap, h("p", { class: "empty" }, err.message)));
  return wrap;
}

function listingRow(x, reload) {
  const [label, tone] = listingState(x);
  const detail = h("div", { class: "mod-detail", hidden: true });
  const toggle = h(
    "button",
    {
      type: "button",
      class: "btn btn-light btn-sm",
      onclick: async () => {
        detail.hidden = !detail.hidden;
        toggle.textContent = detail.hidden ? "İncele" : "Kapat";
        if (!detail.hidden) await listingDetail(x.id, detail, reload);
      },
    },
    "İncele",
  );
  const activeDopings = Object.entries(x.dopings || {}).filter(([, until]) => until > nowIso());
  return h(
    "article",
    { class: "mod-row" },
    h(
      "div",
      { class: "mod-summary" },
      h("div", { class: "mod-thumb" }, x.image ? h("img", { src: thumbUrl(x.image, 200, 150), alt: "" }) : ic("image")),
      h(
        "div",
        { class: "mod-info" },
        h(
          "div",
          { class: "mod-top" },
          statusChip(label, tone),
          activeDopings.map(([k]) => statusChip(DOPING_LABELS[k], "accent")),
          h("small", {}, `#${x.id.toUpperCase()}`),
        ),
        h("strong", {}, x.title),
        h(
          "span",
          {},
          [x.company, categoryName(x.category), x.district ? `${x.city} / ${x.district}` : x.city].join(" · "),
        ),
        h(
          "small",
          {},
          [
            `Eklendi ${fmtDay(x.createdAt)}`,
            x.expiresAt ? `Bitiş ${fmtDay(x.expiresAt)}` : x.credit ? `${x.credit} gün ödenmiş` : "",
            `${x.stats?.view || 0} görüntülenme · ${x.stats?.phone || 0} telefon · ${x.stats?.whatsapp || 0} WhatsApp · ${x.stats?.request || 0} talep`,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
      toggle,
    ),
    detail,
  );
}

async function listingDetail(id, box, reload) {
  fill(box, loading());
  const { listing: l, owner } = await api(`/api/admin/listings/${id}`);
  const run = async (promise, message) => {
    await act(promise, message);
    await reload();
  };
  const isLive = l.status === "active" && l.expiresAt > nowIso();
  const dopingSelect = h(
    "select",
    {},
    Object.entries(DOPING_LABELS).map(([k, v]) => h("option", { value: k }, v)),
  );
  const dopingDays = h("input", {
    type: "number",
    min: 1,
    max: 365,
    value: 7,
    class: "days-input",
    "aria-label": "Gün",
  });

  fill(
    box,
    h(
      "div",
      { class: "mod-grid" },
      h(
        "div",
        {},
        l.images.length
          ? h(
              "div",
              { class: "mod-images" },
              l.images.map((u) =>
                h(
                  "a",
                  { href: u, target: "_blank", rel: "noopener" },
                  h("img", { src: thumbUrl(u, 240, 180), alt: "" }),
                ),
              ),
            )
          : h("p", { class: "empty" }, "Fotoğraf yok."),
        h("p", { class: "mod-desc" }, l.description),
        h(
          "dl",
          { class: "mod-facts" },
          [
            ["Fiyat", l.priceMin ? `${fmtPrice(l.priceMin)} ${l.priceNote}` : "Belirtilmedi"],
            [
              "Etkinlikler",
              (l.events || []).map((e) => state.content.events.find((x) => x.id === e)?.name || e).join(", ") || "—",
            ],
            ["Telefon", `${l.phone}${l.whatsapp ? " (WhatsApp)" : ""}`],
            ["Instagram", l.instagram ? `@${l.instagram}` : "—"],
            ["Takvim", l.showCalendar ? "İlanda gösteriliyor" : "Gizli"],
            [
              "Yayın",
              l.expiresAt
                ? `${fmtDay(l.expiresAt)} tarihine kadar`
                : l.credit
                  ? `Onaylanınca ${l.credit} gün`
                  : "Paket yok",
            ],
          ].map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v))),
        ),
      ),
      h(
        "div",
        { class: "mod-side" },
        owner
          ? h(
              "div",
              { class: "owner-card" },
              h("strong", {}, owner.company, owner.phoneVerified ? statusChip("Onaylı", "ok") : null),
              h("span", {}, owner.name),
              h("a", { href: `mailto:${owner.email}` }, owner.email),
              h("a", { href: `tel:${owner.phone.replace(/[^\d+]/g, "")}` }, owner.phone),
              h("small", {}, `T.C./VKN ${owner.tcVkn || "—"} · Üye ${fmtDay(owner.createdAt)}`),
            )
          : h("p", { class: "empty" }, "İlan sahibi bulunamadı."),
        l.rejectReason ? h("p", { class: "notice notice-warn" }, `Red nedeni: ${l.rejectReason}`) : null,
        h(
          "div",
          { class: "mod-actions" },
          l.status !== "active" || !isLive
            ? h(
                "button",
                {
                  type: "button",
                  class: "btn btn-primary btn-sm",
                  disabled: !paid(l),
                  title: paid(l) ? "" : "Önce ödemeyi onaylayın ya da süre ekleyin.",
                  onclick: () =>
                    run(
                      api(`/api/admin/listings/${id}/moderate`, { method: "POST", body: { status: "active" } }),
                      "İlan yayına alındı.",
                    ),
                },
                "Onayla ve yayınla",
              )
            : null,
          h(
            "button",
            {
              type: "button",
              class: "btn btn-light btn-sm danger",
              onclick: () => {
                const reason = prompt("Red nedeni (organizatör görecek):", "İlan yayın kurallarına uygun bulunmadı.");
                if (reason !== null)
                  run(
                    api(`/api/admin/listings/${id}/moderate`, { method: "POST", body: { status: "rejected", reason } }),
                    "İlan reddedildi.",
                  );
              },
            },
            "Reddet",
          ),
          l.status === "active"
            ? h(
                "button",
                {
                  type: "button",
                  class: "btn btn-light btn-sm",
                  onclick: () =>
                    run(
                      api(`/api/admin/listings/${id}/moderate`, { method: "POST", body: { status: "passive" } }),
                      "İlan yayından kaldırıldı.",
                    ),
                },
                "Yayından kaldır",
              )
            : null,
          h(
            "button",
            {
              type: "button",
              class: "btn btn-light btn-sm",
              onclick: () => {
                const days = prompt("Yayın süresine kaç gün eklensin? (ücretsiz/manuel paket)", "30");
                if (days)
                  run(
                    api(`/api/admin/listings/${id}/extend`, { method: "POST", body: { days: Number(days) } }),
                    `${days} gün eklendi.`,
                  );
              },
            },
            "Süre ekle",
          ),
          isLive
            ? h(
                "a",
                { class: "btn btn-light btn-sm", href: `/ilan/${l.slug}-${l.id}`, target: "_blank", rel: "noopener" },
                "Sitede gör ↗",
              )
            : null,
          h(
            "button",
            {
              type: "button",
              class: "btn btn-ghost btn-sm danger",
              onclick: () =>
                confirm("İlan ve fotoğrafları kalıcı olarak silinsin mi?") &&
                run(api(`/api/admin/listings/${id}`, { method: "DELETE" }), "İlan silindi."),
            },
            "Sil",
          ),
        ),
        h(
          "div",
          { class: "doping-admin" },
          h("strong", {}, "Doping tanımla"),
          h(
            "div",
            { class: "inline-form" },
            dopingSelect,
            dopingDays,
            h("span", {}, "gün"),
            h(
              "button",
              {
                type: "button",
                class: "btn btn-light btn-sm",
                onclick: () =>
                  run(
                    api(`/api/admin/listings/${id}/doping`, {
                      method: "POST",
                      body: { doping: dopingSelect.value, days: Number(dopingDays.value) },
                    }),
                    "Doping tanımlandı.",
                  ),
              },
              "Ekle",
            ),
          ),
          Object.entries(l.dopings || {})
            .filter(([, until]) => until > nowIso())
            .map(([k, until]) =>
              h(
                "p",
                { class: "doping-line" },
                `${DOPING_LABELS[k]}: ${fmtDay(until)} tarihine kadar`,
                h(
                  "button",
                  {
                    type: "button",
                    class: "link-btn",
                    onclick: () =>
                      run(
                        api(`/api/admin/listings/${id}/doping`, { method: "POST", body: { doping: k, days: 0 } }),
                        "Doping kaldırıldı.",
                      ),
                  },
                  "Kaldır",
                ),
              ),
            ),
        ),
      ),
    ),
  );
}

/* ---------- Ödemeler ---------- */

let orderTab = "awaiting";
const ORDER_STATUS = { awaiting: ["Ödeme bekleniyor", "alert"], paid: ["Ödendi", "ok"], cancelled: ["İptal", "muted"] };

function renderOrdersAdmin() {
  const wrap = h("div", { class: "page-body" }, loading());
  let orders = [];
  const load = async () => {
    orders = (await api("/api/admin/orders")).orders;
    draw();
  };
  function draw() {
    const items = orders.filter((o) => orderTab === "all" || o.status === orderTab);
    const bank = state.content.pricing.bank;
    fill(
      wrap,
      !bank.iban && !state.content.pricing.freeMode
        ? h(
            "p",
            { class: "notice notice-warn" },
            "IBAN bilgisi girilmedi; organizatörler ödeme bilgisini göremez. Fiyatlandırma sayfasından ekleyin.",
          )
        : null,
      h(
        "div",
        { class: "toolbar" },
        tabs(
          [
            ["awaiting", "Bekleyen", orders.filter((o) => o.status === "awaiting").length],
            ["paid", "Ödenen", orders.filter((o) => o.status === "paid").length],
            ["cancelled", "İptal", orders.filter((o) => o.status === "cancelled").length],
            ["all", "Tümü", orders.length],
          ],
          orderTab,
          (v) => ((orderTab = v), draw()),
        ),
      ),
      items.length
        ? h(
            "div",
            { class: "card table-wrap" },
            h(
              "table",
              { class: "table" },
              h(
                "thead",
                {},
                h(
                  "tr",
                  {},
                  ["Sipariş", "Tarih", "Organizatör", "Ürün", "İlan", "Tutar", "Durum", ""].map((t) => h("th", {}, t)),
                ),
              ),
              h(
                "tbody",
                {},
                items.map((o) =>
                  h(
                    "tr",
                    {},
                    h("td", {}, h("strong", {}, o.no)),
                    h("td", {}, fmtDate(o.createdAt)),
                    h("td", {}, o.company),
                    h("td", {}, o.label, o.promo ? h("small", { class: "muted" }, ` · ${o.promo}`) : null),
                    h("td", {}, o.listingTitle),
                    h(
                      "td",
                      {},
                      o.amount ? fmtPrice(o.amount) : "Ücretsiz",
                      o.discount ? h("small", { class: "muted" }, ` (−${fmtPrice(o.discount)})`) : null,
                    ),
                    h("td", {}, statusChip(...ORDER_STATUS[o.status])),
                    h(
                      "td",
                      { class: "cell-actions" },
                      o.status === "awaiting"
                        ? [
                            h(
                              "button",
                              {
                                type: "button",
                                class: "btn btn-primary btn-sm",
                                onclick: async () => {
                                  if (!confirm(`${o.no} için ${fmtPrice(o.amount)} ödeme alındı mı?`)) return;
                                  await act(
                                    api(`/api/admin/orders/${o.id}/confirm`, { method: "POST", body: {} }),
                                    "Ödeme onaylandı.",
                                  );
                                  load();
                                },
                              },
                              "Ödeme alındı",
                            ),
                            h(
                              "button",
                              {
                                type: "button",
                                class: "btn btn-ghost btn-sm danger",
                                onclick: async () => {
                                  if (!confirm("Sipariş iptal edilsin mi?")) return;
                                  await act(
                                    api(`/api/admin/orders/${o.id}/cancel`, { method: "POST", body: {} }),
                                    "Sipariş iptal edildi.",
                                  );
                                  load();
                                },
                              },
                              "İptal",
                            ),
                          ]
                        : null,
                    ),
                  ),
                ),
              ),
            ),
          )
        : h("p", { class: "empty" }, "Bu bölümde sipariş yok."),
    );
  }
  load().catch((err) => fill(wrap, h("p", { class: "empty" }, err.message)));
  return wrap;
}

/* ---------- Promosyon kodları ---------- */

function renderPromos() {
  const wrap = h("div", { class: "page-body" }, loading());
  const blank = {
    code: "",
    discountPercent: 100,
    package: "quarterly",
    maxUses: 100,
    expiresAt: "",
    active: true,
    note: "",
  };
  let editing = { ...blank };

  const load = async () => {
    const { promos } = await api("/api/admin/promos");
    draw(promos);
  };
  function draw(promos) {
    const form = h(
      "form",
      {
        class: "form-grid",
        onsubmit: async (e) => {
          e.preventDefault();
          await act(api("/api/admin/promos", { method: "POST", body: editing }), "Kod kaydedildi.");
          editing = { ...blank };
          load();
        },
      },
      field(editing, {
        key: "code",
        label: "Kod",
        placeholder: "Örn. MAYA3AY",
        help: "Harf ve rakam; büyük/küçük harf fark etmez.",
      }),
      field(editing, { key: "discountPercent", label: "İndirim (%)", type: "number", min: 1, max: 100 }),
      field(editing, {
        key: "package",
        label: "Geçerli paket",
        type: "select",
        options: Object.entries(PACKAGE_LABELS),
      }),
      field(editing, { key: "maxUses", label: "Kullanım limiti", type: "number", help: "0 = sınırsız" }),
      field(editing, { key: "expiresAt", label: "Son kullanma tarihi", inputType: "date" }),
      field(editing, { key: "active", label: "Durum", type: "toggle", toggleLabel: "Aktif" }),
      field(editing, { key: "note", label: "Not (kampanya adı vb.)", wide: true }),
      h("div", { class: "is-wide" }, h("button", { class: "btn btn-primary", type: "submit" }, "Kodu kaydet")),
    );
    fill(
      wrap,
      card(
        "Yeni kod / düzenle",
        "Örnek: MAYA3AY · %100 · 3 Aylık · ilk 100 kişi. Her organizatör bir kodu bir kez kullanabilir.",
        form,
      ),
      promos.length
        ? h(
            "div",
            { class: "card table-wrap" },
            h(
              "table",
              { class: "table" },
              h(
                "thead",
                {},
                h(
                  "tr",
                  {},
                  ["Kod", "İndirim", "Paket", "Kullanım", "Son tarih", "Durum", ""].map((t) => h("th", {}, t)),
                ),
              ),
              h(
                "tbody",
                {},
                promos.map((p) =>
                  h(
                    "tr",
                    {},
                    h(
                      "td",
                      {},
                      h("strong", {}, p.code),
                      p.note ? h("small", { class: "muted" }, ` · ${p.note}`) : null,
                    ),
                    h("td", {}, `%${p.discountPercent}`),
                    h("td", {}, PACKAGE_LABELS[p.package]),
                    h("td", {}, `${p.usedCount} / ${p.maxUses || "∞"}`),
                    h("td", {}, p.expiresAt ? fmtDay(p.expiresAt) : "—"),
                    h("td", {}, statusChip(p.active ? "Aktif" : "Pasif", p.active ? "ok" : "muted")),
                    h(
                      "td",
                      { class: "cell-actions" },
                      h(
                        "button",
                        {
                          type: "button",
                          class: "btn btn-light btn-sm",
                          onclick: () => ((editing = { ...p }), draw(promos), window.scrollTo(0, 0)),
                        },
                        "Düzenle",
                      ),
                      h(
                        "button",
                        {
                          type: "button",
                          class: "btn btn-ghost btn-sm danger",
                          onclick: async () => {
                            if (!confirm(`${p.code} silinsin mi?`)) return;
                            await act(
                              api(`/api/admin/promos/${encodeURIComponent(p.code)}`, { method: "DELETE" }),
                              "Kod silindi.",
                            );
                            load();
                          },
                        },
                        "Sil",
                      ),
                    ),
                  ),
                ),
              ),
            ),
          )
        : h("p", { class: "empty" }, "Henüz promosyon kodu yok."),
    );
  }
  load().catch((err) => fill(wrap, h("p", { class: "empty" }, err.message)));
  return wrap;
}

/* ---------- Üyeler ---------- */

let userTab = "organizer";
let userQuery = "";

function renderUsers() {
  const wrap = h("div", { class: "page-body" }, loading());
  let users = [];
  const load = async () => {
    users = (await api("/api/admin/users")).users;
    draw();
  };
  function draw() {
    const q = userQuery.toLocaleLowerCase("tr");
    const items = users
      .filter((u) => (u.role || "organizer") === userTab)
      .filter((u) => !q || `${u.company} ${u.name} ${u.email} ${u.phone}`.toLocaleLowerCase("tr").includes(q));
    const action = (label, cls, fn) => h("button", { type: "button", class: `btn btn-sm ${cls}`, onclick: fn }, label);
    fill(
      wrap,
      h(
        "div",
        { class: "toolbar" },
        tabs(
          [
            ["organizer", "Organizatörler", users.filter((u) => (u.role || "organizer") === "organizer").length],
            ["client", "Doğrulanmış ziyaretçiler", users.filter((u) => u.role === "client").length],
          ],
          userTab,
          (v) => ((userTab = v), draw()),
        ),
        h("input", {
          class: "search-input",
          type: "search",
          placeholder: "Ad, firma, e-posta ya da telefon ara",
          value: userQuery,
          oninput: (e) => {
            userQuery = e.target.value;
            draw();
            wrap.querySelector(".search-input")?.focus();
          },
        }),
      ),
      items.length
        ? h(
            "div",
            { class: "card table-wrap" },
            h(
              "table",
              { class: "table" },
              h(
                "thead",
                {},
                h(
                  "tr",
                  {},
                  (userTab === "organizer"
                    ? ["Firma", "İletişim", "T.C./VKN", "İlanlar", "Üyelik", "Durum", ""]
                    : ["Telefon", "Doğrulama", "Durum", ""]
                  ).map((t) => h("th", {}, t)),
                ),
              ),
              h(
                "tbody",
                {},
                items.map((u) => {
                  const banned = u.status === "banned";
                  const actions = h(
                    "td",
                    { class: "cell-actions" },
                    action(banned ? "Engeli kaldır" : "Engelle", "btn-light", async () => {
                      if (
                        !banned &&
                        !confirm(`${u.company || u.phone} engellensin mi? Yayındaki ilanları da kaldırılır.`)
                      )
                        return;
                      await act(
                        api(`/api/admin/users/${u.id}/ban`, { method: "POST", body: { banned: !banned } }),
                        banned ? "Engel kaldırıldı." : "Üye engellendi.",
                      );
                      load();
                    }),
                    u.role !== "client"
                      ? action("Şifre sıfırla", "btn-light", async () => {
                          if (!confirm(`${u.company} için yeni geçici şifre oluşturulsun mu?`)) return;
                          const { password } = await act(
                            api(`/api/admin/users/${u.id}/reset-password`, { method: "POST", body: {} }),
                          );
                          prompt(
                            `Geçici şifre (üyeye güvenli bir yoldan iletin; giriş yapınca değiştirmesini isteyin):`,
                            password,
                          );
                        })
                      : null,
                    action("Sil", "btn-ghost danger", async () => {
                      if (!confirm("Üye, ilanları ve takvim kayıtları kalıcı olarak silinsin mi?")) return;
                      await act(api(`/api/admin/users/${u.id}`, { method: "DELETE" }), "Üye silindi.");
                      load();
                    }),
                  );
                  const status = statusChip(banned ? "Engelli" : "Aktif", banned ? "bad" : "ok");
                  return userTab === "organizer"
                    ? h(
                        "tr",
                        {},
                        h("td", {}, h("strong", {}, u.company), h("br"), h("small", { class: "muted" }, u.name)),
                        h(
                          "td",
                          {},
                          h("a", { href: `mailto:${u.email}` }, u.email),
                          h("br"),
                          u.phone,
                          u.phoneVerified ? statusChip("Onaylı", "ok") : null,
                        ),
                        h("td", {}, u.tcVkn || "—"),
                        h(
                          "td",
                          {},
                          `${u.listings.active} yayında · ${u.listings.pending} bekleyen · ${u.listings.total} toplam`,
                        ),
                        h("td", {}, fmtDay(u.createdAt)),
                        h("td", {}, status),
                        actions,
                      )
                    : h(
                        "tr",
                        {},
                        h("td", {}, u.phone),
                        h("td", {}, fmtDate(u.createdAt)),
                        h("td", {}, status),
                        actions,
                      );
                }),
              ),
            ),
          )
        : h("p", { class: "empty" }, "Kayıt yok."),
    );
  }
  load().catch((err) => fill(wrap, h("p", { class: "empty" }, err.message)));
  return wrap;
}

/* ---------- Kara liste ---------- */

function renderBlacklist() {
  const wrap = h("div", { class: "page-body" }, loading());
  const load = async () => {
    const { records } = await api("/api/admin/blacklist");
    fill(
      wrap,
      h(
        "p",
        { class: "notice notice-info" },
        `Organizatörler kötü niyetli müşterileri bildirir. ${state.content.security.blacklistThreshold} farklı organizatörden ihbar alan numara otomatik engellenir; engelli numaralar SMS doğrulaması yapamaz ve iletişim bilgilerini göremez.`,
      ),
      records.length
        ? h(
            "div",
            { class: "mod-list" },
            records.map((r) =>
              h(
                "article",
                { class: "card blacklist-card" },
                h(
                  "div",
                  { class: "mod-top" },
                  h(
                    "strong",
                    {},
                    `0${r.phone.slice(2, 5)} ${r.phone.slice(5, 8)} ${r.phone.slice(8, 10)} ${r.phone.slice(10)}`,
                  ),
                  statusChip(r.blocked ? "Engelli" : `${r.reports.length} ihbar`, r.blocked ? "bad" : "warn"),
                ),
                h(
                  "ul",
                  { class: "report-list" },
                  r.reports.map((x) =>
                    h(
                      "li",
                      {},
                      h("strong", {}, x.company),
                      ` · ${BLACKLIST_REASONS[x.reason] || x.reason} · ${fmtDay(x.createdAt)}`,
                      x.note ? h("p", {}, x.note) : null,
                    ),
                  ),
                ),
                h(
                  "div",
                  { class: "mod-actions" },
                  h(
                    "button",
                    {
                      type: "button",
                      class: "btn btn-light btn-sm",
                      onclick: async () => {
                        await act(
                          api(`/api/admin/blacklist/${r.id}`, { method: "PATCH", body: { blocked: !r.blocked } }),
                          r.blocked ? "Engel kaldırıldı." : "Numara engellendi.",
                        );
                        load();
                      },
                    },
                    r.blocked ? "Engeli kaldır" : "Engelle",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "btn btn-ghost btn-sm danger",
                      onclick: async () => {
                        if (!confirm("Kayıt ve tüm ihbarlar silinsin mi?")) return;
                        await act(api(`/api/admin/blacklist/${r.id}`, { method: "DELETE" }), "Kayıt silindi.");
                        load();
                      },
                    },
                    "Sil",
                  ),
                ),
              ),
            ),
          )
        : h("p", { class: "empty" }, "Henüz ihbar yok."),
    );
  };
  load().catch((err) => fill(wrap, h("p", { class: "empty" }, err.message)));
  return wrap;
}

/* ---------- Şikâyetler ---------- */

function renderReports() {
  const wrap = h("div", { class: "page-body" }, loading());
  const load = async () => {
    const { reports } = await api("/api/admin/reports");
    fill(
      wrap,
      reports.length
        ? h(
            "div",
            { class: "mod-list" },
            reports.map((r) =>
              h(
                "article",
                { class: `card report-card${r.status === "open" ? " is-open" : ""}` },
                h(
                  "div",
                  { class: "mod-top" },
                  statusChip(r.status === "open" ? "Açık" : "Kapatıldı", r.status === "open" ? "alert" : "muted"),
                  h("small", {}, fmtDate(r.createdAt)),
                ),
                h("strong", {}, r.listingTitle),
                h("span", {}, REPORT_REASONS[r.reason] || r.reason),
                r.message ? h("p", { class: "message-text" }, r.message) : null,
                h(
                  "div",
                  { class: "mod-actions" },
                  h(
                    "button",
                    {
                      type: "button",
                      class: "btn btn-light btn-sm",
                      onclick: () => {
                        listingTab = "all";
                        listingQuery = r.listingId;
                        go("ilanlar");
                      },
                    },
                    "İlanı incele",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "btn btn-light btn-sm",
                      onclick: async () => {
                        await act(
                          api(`/api/admin/reports/${r.id}`, {
                            method: "PATCH",
                            body: { status: r.status === "open" ? "closed" : "open" },
                          }),
                        );
                        load();
                      },
                    },
                    r.status === "open" ? "Kapat" : "Yeniden aç",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "btn btn-ghost btn-sm danger",
                      onclick: async () => {
                        await act(api(`/api/admin/reports/${r.id}`, { method: "DELETE" }), "Şikâyet silindi.");
                        load();
                      },
                    },
                    "Sil",
                  ),
                ),
              ),
            ),
          )
        : h("p", { class: "empty" }, "Şikâyet yok."),
    );
  };
  load().catch((err) => fill(wrap, h("p", { class: "empty" }, err.message)));
  return wrap;
}

/* ---------- Değerlendirmeler ---------- */

const REVIEW_STATUS = {
  pending: ["Onay bekliyor", "alert"],
  published: ["Yayında", "ok"],
  rejected: ["Reddedildi", "muted"],
};
let reviewTab = "pending";

function renderReviewsAdmin() {
  const wrap = h("div", { class: "page-body" }, loading());
  const load = async () => {
    const { reviews } = await api("/api/admin/reviews");
    const count = (status) => reviews.filter((r) => r.status === status).length;
    const shown = reviews.filter((r) => reviewTab === "all" || r.status === reviewTab);
    const moderate = async (r, status, message) => {
      await act(api(`/api/admin/reviews/${r.organizerId}/${r.id}`, { method: "PATCH", body: { status } }), message);
      load();
    };
    fill(
      wrap,
      tabs(
        [
          ["pending", "Onay bekleyen", count("pending")],
          ["published", "Yayında", count("published")],
          ["rejected", "Reddedilen", count("rejected")],
          ["all", "Tümü", reviews.length],
        ],
        reviewTab,
        (value) => {
          reviewTab = value;
          load();
        },
      ),
      shown.length
        ? h(
            "div",
            { class: "mod-list" },
            shown.map((r) =>
              h(
                "article",
                { class: `card report-card${r.status === "pending" ? " is-open" : ""}` },
                h(
                  "div",
                  { class: "mod-top" },
                  statusChip(...REVIEW_STATUS[r.status]),
                  h("small", {}, fmtDate(r.createdAt)),
                ),
                h("strong", {}, `${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}  ${r.company}`),
                h("span", {}, `Yazan: ${r.authorName}`),
                h("p", { class: "message-text" }, r.comment),
                r.reply ? h("p", { class: "message-text" }, h("strong", {}, "Firma yanıtı: "), r.reply) : null,
                h(
                  "div",
                  { class: "mod-actions" },
                  r.status !== "published"
                    ? h(
                        "button",
                        {
                          type: "button",
                          class: "btn btn-primary btn-sm",
                          onclick: () => moderate(r, "published", "Değerlendirme yayınlandı."),
                        },
                        "Yayınla",
                      )
                    : null,
                  r.status !== "rejected"
                    ? h(
                        "button",
                        {
                          type: "button",
                          class: "btn btn-light btn-sm",
                          onclick: () => moderate(r, "rejected", "Değerlendirme reddedildi."),
                        },
                        r.status === "published" ? "Yayından kaldır" : "Reddet",
                      )
                    : null,
                  h(
                    "button",
                    {
                      type: "button",
                      class: "btn btn-ghost btn-sm danger",
                      onclick: async () => {
                        if (!confirm("Değerlendirme kalıcı olarak silinsin mi?")) return;
                        await act(
                          api(`/api/admin/reviews/${r.organizerId}/${r.id}`, { method: "DELETE" }),
                          "Değerlendirme silindi.",
                        );
                        load();
                      },
                    },
                    "Sil",
                  ),
                ),
              ),
            ),
          )
        : h("p", { class: "empty" }, "Bu bölümde değerlendirme yok."),
    );
  };
  load().catch((err) => fill(wrap, h("p", { class: "empty" }, err.message)));
  return wrap;
}

/* ---------- İçerik ve ayar sayfaları ---------- */

const SECTION_NAMES = {
  events: "Etkinlikler (Ne kutluyorsunuz?)",
  categories: "Hizmet kategorileri",
  featured: "Vitrin",
  recent: "Son eklenen ilanlar",
  cities: "Şehirler",
  process: "Nasıl çalışır",
  vendor: "Organizatör çağrısı",
  faq: "Sıkça sorulanlar",
};

const PAGES = {
  panel: { title: "Genel bakış", render: renderDashboard },
  ziyaretler: {
    title: "Ziyaret istatistikleri",
    description: "Siteye kaç kişinin geldiği, nelere baktığı, nereden geldiği ve organizatörlere ne kadar ulaşıldığı.",
    render: renderAnalytics,
  },
  ilanlar: {
    title: "İlanlar",
    description: "Onay kuyruğu ve tüm ilanlar. Ödemesi onaylanmamış ilan yayına alınamaz.",
    render: renderListingsAdmin,
  },
  odemeler: {
    title: "Ödemeler",
    description: "Havale/EFT ile gelen paket ve doping ödemelerini burada onaylayın.",
    render: renderOrdersAdmin,
  },
  promosyonlar: {
    title: "Promosyon kodları",
    description: "Sosyal medya kampanyaları için indirim kodları.",
    render: renderPromos,
  },
  uyeler: { title: "Üyeler", render: renderUsers },
  karaliste: { title: "Kara liste", render: renderBlacklist },
  sikayetler: { title: "Şikâyetler", description: "Ziyaretçilerin ilan bildirimleri.", render: renderReports },
  degerlendirmeler: {
    title: "Değerlendirmeler",
    description:
      "Firmalara yazılan yorumlar. Yalnızca firmaya site üzerinden teklif isteyen, telefonu doğrulanmış müşteriler yazabilir; onayladığınız yorumlar firma sayfasında yayınlanır.",
    render: renderReviewsAdmin,
  },
  mesajlar: { title: "Mesajlar", description: "İletişim sayfasından gelen mesajlar.", render: renderMessages },

  anasayfa: {
    title: "Ana sayfa",
    render: () => [
      card(
        "Karşılama alanı",
        null,
        formGrid(state.content.hero, [
          { key: "eyebrow", label: "Üst satır", wide: true },
          { key: "title", label: "Başlık" },
          { key: "highlight", label: "Vurgulu başlık", help: "Başlığın altında renkli görünen kısım." },
          { key: "subtitle", label: "Açıklama", type: "textarea", rows: 3, wide: true },
          {
            key: "image",
            label: "Kemer görseli",
            type: "image",
            wide: true,
            help: "Dikey (4:5) bir fotoğraf önerilir. Boşsa balon çizimi görünür.",
          },
        ]),
      ),
      card(
        "Organizatör çağrısı maddeleri",
        null,
        formGrid(state.content, [{ key: "vendorPoints", label: "Maddeler", type: "list", wide: true }]),
      ),
      ...Object.entries(SECTION_NAMES).map(([key, name]) =>
        card(name, "Bölüm başlığı", formGrid(state.content.sections[key], SECTION_FIELDS)),
      ),
    ],
  },

  kategoriler: {
    title: "Hizmet kategorileri",
    description: "Organizatör türleri. Kademe (Tier), ilan paketi fiyatını belirler.",
    render: () => [
      card(
        "Kategoriler",
        'Bir kategoriyi silerseniz o kategorideki ilanlar "—" olarak görünür; önce ilanları taşımanız önerilir.',
        listEditor("categories", {
          label: "Kategori",
          titleOf: (c) => (c.name ? `${c.name} · Tier ${c.tier}` : ""),
          fields: [
            { key: "name", label: "Ad" },
            {
              key: "tier",
              label: "Fiyat kademesi",
              type: "select",
              number: true,
              options: [
                [1, "Tier 1 · Üst segment"],
                [2, "Tier 2 · Orta segment"],
                [3, "Tier 3 · Mikro segment"],
              ],
            },
            {
              key: "slug",
              label: "Adres",
              help: "/ilanlar?kategori=... Boş bırakılırsa addan üretilir. Yayındaki kategoride değiştirmeyin.",
            },
            { key: "icon", label: "İkon", type: "icon", wide: true },
          ],
        }),
      ),
    ],
  },

  etkinlikler: {
    title: "Etkinlik türleri",
    description: '"Ne kutluyorsunuz?" kutuları ve ilanlardaki etkinlik etiketleri.',
    render: () => [
      card(
        "Etkinlikler",
        null,
        listEditor("events", {
          label: "Etkinlik",
          titleOf: (e) => e.name,
          fields: [
            { key: "name", label: "Ad" },
            { key: "slug", label: "Adres", help: "/ilanlar?etkinlik=... Boş bırakılırsa addan üretilir." },
            { key: "icon", label: "İkon", type: "icon", wide: true },
          ],
        }),
      ),
    ],
  },

  surec: {
    title: "Nasıl çalışır",
    render: () => [
      card(
        "Adımlar",
        null,
        listEditor("steps", {
          label: "Adım",
          titleOf: (s) => s.title,
          fields: [
            { key: "title", label: "Başlık" },
            { key: "text", label: "Açıklama", type: "textarea", rows: 2, wide: true },
          ],
        }),
      ),
    ],
  },

  sss: {
    title: "Sıkça sorulanlar",
    render: () => [
      card(
        "Sorular",
        null,
        listEditor("faq", {
          label: "Soru",
          titleOf: (f) => f.q,
          fields: [
            { key: "q", label: "Soru", wide: true },
            { key: "a", label: "Cevap", type: "textarea", rows: 3, wide: true },
          ],
        }),
      ),
    ],
  },

  fiyatlar: {
    title: "Fiyatlandırma",
    description: "İlan paketleri (kademeye göre), dopingler ve havale/EFT bilgileri.",
    render: () => {
      const p = state.content.pricing;
      return [
        card(
          "Ücretsiz mod",
          "Açıkken organizatörler paket ve doping için ödeme yapmaz (lansman dönemi).",
          formGrid(p, [{ key: "freeMode", label: "Durum", type: "toggle", toggleLabel: "Tüm paketler ücretsiz" }]),
        ),
        ...["t1", "t2", "t3"].map((t, i) =>
          card(
            `Tier ${i + 1} · ${p.tiers[t].name}`,
            state.content.categories
              .filter((c) => c.tier === i + 1)
              .map((c) => c.name)
              .join(", ") || "Bu kademede kategori yok.",
            formGrid(p.tiers[t], [
              { key: "name", label: "Kademe adı" },
              { key: "monthly", label: "Aylık (₺)", type: "number" },
              { key: "quarterly", label: "3 aylık (₺)", type: "number" },
              { key: "yearly", label: "Yıllık (₺)", type: "number", help: "PRD: 2 ay bedava" },
            ]),
          ),
        ),
        card(
          "Dopingler",
          "Süre gün olarak; fiyat her satın alma içindir.",
          h(
            "div",
            { class: "doping-cards" },
            Object.entries(DOPING_LABELS).map(([k, label]) =>
              h(
                "div",
                { class: "sub-card" },
                h("strong", {}, label),
                formGrid(p.dopings[k], [
                  { key: "price", label: "Fiyat (₺)", type: "number" },
                  { key: "days", label: "Süre (gün)", type: "number", min: 1 },
                ]),
              ),
            ),
          ),
        ),
        card(
          "Havale / EFT bilgileri",
          "Kartla ödeme altyapısı (iyzico/PayTR) bağlanana kadar organizatörler bu hesaba ödeme yapar.",
          formGrid(p.bank, [
            { key: "bankName", label: "Banka" },
            { key: "holder", label: "Alıcı adı" },
            { key: "iban", label: "IBAN", wide: true, placeholder: "TR00 0000 0000 0000 0000 0000 00" },
            { key: "note", label: "Ödeme notu", wide: true },
          ]),
        ),
      ];
    },
  },

  guvenlik: {
    title: "Güvenlik & SMS",
    render: () => {
      const sms = state.summary?.sms;
      return [
        h(
          "p",
          { class: `notice notice-${sms?.configured && !sms?.testMode ? "ok" : "warn"}` },
          !sms
            ? "SMS durumu alınamadı."
            : !sms.configured
              ? "SMS sağlayıcısı bağlı değil: iletişim bariyeri devre dışı. Netlify'da SMS_PROVIDER=netgsm, NETGSM_USERCODE, NETGSM_PASSWORD ve NETGSM_HEADER ortam değişkenlerini tanımlayın."
              : sms.testMode
                ? "SMS test modunda (SMS_TEST_MODE=1): kodlar gönderilmez, sunucu kaydına yazılır."
                : "SMS sağlayıcısı bağlı.",
        ),
        card(
          "İletişim bariyeri ve kara liste",
          null,
          formGrid(state.content.security, [
            {
              key: "contactGate",
              label: "İletişim bariyeri",
              type: "toggle",
              toggleLabel: "Telefon/WhatsApp için SMS doğrulaması zorunlu",
              help: "SMS sağlayıcısı bağlı değilse otomatik olarak devre dışı kalır.",
            },
            {
              key: "blacklistThreshold",
              label: "Engelleme eşiği",
              type: "number",
              min: 1,
              max: 10,
              help: "Kaç farklı organizatörden ihbar alan numara engellensin (PRD: 2).",
            },
            {
              key: "requestSms",
              label: "Teklif talebi bildirimi",
              type: "toggle",
              toggleLabel: "Yeni teklif talebinde organizatöre SMS gönder",
              help: "Organizatörün doğrulanmış telefonuna gider. SMS ücretlidir; numara başına günde en fazla 10 bildirim.",
            },
          ]),
        ),
      ];
    },
  },

  iletisim: {
    title: "İletişim bilgileri",
    description: "Sitenin altında ve İletişim sayfasında görünür. Boş alanlar gösterilmez.",
    render: () => [
      card(
        "Bilgiler",
        null,
        formGrid(state.content.settings, [
          { key: "phone", label: "Telefon", inputType: "tel" },
          { key: "whatsapp", label: "WhatsApp", inputType: "tel" },
          { key: "whatsappMessage", label: "WhatsApp hazır mesajı", wide: true },
          { key: "email", label: "E-posta", inputType: "email" },
          { key: "workingHours", label: "Çalışma saatleri" },
          { key: "address", label: "Adres", wide: true },
        ]),
      ),
      card(
        "Sosyal medya",
        "Kullanıcı adı ya da tam bağlantı.",
        formGrid(state.content.settings, [
          { key: "instagram", label: "Instagram" },
          { key: "tiktok", label: "TikTok" },
          { key: "facebook", label: "Facebook" },
        ]),
      ),
    ],
  },

  seo: {
    title: "Marka & SEO",
    render: () => [
      card(
        "Marka",
        null,
        formGrid(state.content.settings, [
          { key: "siteName", label: "Site adı" },
          { key: "tagline", label: "Kısa slogan" },
        ]),
      ),
      card(
        "Arama motorları ve paylaşım",
        null,
        formGrid(state.content.settings, [
          { key: "seoTitle", label: "Sayfa başlığı", wide: true },
          { key: "seoDescription", label: "Açıklama", type: "textarea", rows: 3, wide: true },
          { key: "ogImage", label: "Paylaşım görseli", type: "image", wide: true, help: "Yatay 1200×630 önerilir." },
          { key: "siteUrl", label: "Site adresi", wide: true, inputType: "url" },
        ]),
      ),
      card(
        "Android uygulaması (Google Play)",
        "Uygulama PWABuilder ile siteden oluşturulur (adımlar README dosyasında). Paket adı ve imza parmak izi girildiğinde /.well-known/assetlinks.json dosyası otomatik yayınlanır; böylece uygulamada adres çubuğu görünmez.",
        formGrid(state.content.settings, [
          {
            key: "playStoreUrl",
            label: "Google Play bağlantısı",
            wide: true,
            inputType: "url",
            help: "Uygulama yayınlanınca sitenin alt kısmında indirme bağlantısı görünür.",
          },
          { key: "androidPackage", label: "Paket adı", help: "Örn. net.organizasyonsepeti.twa" },
          {
            key: "androidSha256",
            label: "SHA-256 imza parmak izi",
            type: "textarea",
            rows: 3,
            wide: true,
            help: "Play Console > Uygulama bütünlüğü > Uygulama imzalama bölümündeki SHA-256 değeri. Birden fazlaysa her satıra bir tane.",
          },
        ]),
      ),
    ],
  },

  yasal: {
    title: "Yasal metinler",
    render: () => [
      h(
        "p",
        { class: "notice notice-warn" },
        "Bu metinler genel şablondur. Yayına almadan önce bir hukukçuya kontrol ettirmeniz önerilir.",
      ),
      card(
        "Yazım kuralları",
        '{siteName}, {phone}, {email}, {address} ve {contact} yazdığınız yerlere bilgiler otomatik gelir. "## " ile başlayan satırlar başlık, "- " ile başlayanlar madde olur.',
        h(
          "div",
          { class: "toolbar" },
          h("a", { class: "btn btn-light btn-sm", href: "/kvkk", target: "_blank" }, "KVKK sayfası ↗"),
          h(
            "a",
            { class: "btn btn-light btn-sm", href: "/kullanim-kosullari", target: "_blank" },
            "Kullanım koşulları ↗",
          ),
        ),
      ),
      card(
        "KVKK aydınlatma metni",
        null,
        formGrid(state.content.legal, [{ key: "kvkk", label: "Metin", type: "textarea", rows: 22, wide: true }]),
      ),
      card(
        "Kullanım koşulları",
        null,
        formGrid(state.content.legal, [{ key: "terms", label: "Metin", type: "textarea", rows: 22, wide: true }]),
      ),
    ],
  },

  medya: { title: "Medya kütüphanesi", description: "Panelden yüklediğiniz görseller.", render: renderMedia },
  hesap: { title: "Hesap & yedekler", render: renderAccount },
};

/* ---------- Mesajlar ---------- */

let messageFilter = "all";

async function loadMessages() {
  try {
    state.messages = (await api("/api/messages")).messages;
  } catch (err) {
    if (err.status !== 401) toast(err.message, "error");
  }
  renderNav();
}

function waLink(m) {
  let digits = m.phone.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) digits = `9${digits}`;
  if (/^5\d{9}$/.test(digits)) digits = `90${digits}`;
  const text = `Merhaba ${m.name}, ${state.content.settings.siteName}'nden yazıyorum. Teklif talebiniz için teşekkür ederiz.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function renderMessages() {
  const list = h("div", { class: "messages" });
  const tabs = h("div", { class: "tabs", role: "tablist" });

  const render = () => {
    const unread = state.messages.filter((m) => !m.read).length;
    fill(
      tabs,
      ...[
        ["all", `Tümü (${state.messages.length})`],
        ["unread", `Okunmamış (${unread})`],
      ].map(([value, label]) =>
        h(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(messageFilter === value),
            class: messageFilter === value ? "is-active" : "",
            onclick: () => ((messageFilter = value), render()),
          },
          label,
        ),
      ),
    );
    const items = state.messages.filter((m) => messageFilter === "all" || !m.read);
    fill(
      list,
      ...(items.length
        ? items.map((m) =>
            h(
              "article",
              { class: `message${m.read ? "" : " is-unread"}` },
              h(
                "header",
                {},
                h("div", {}, h("h3", {}, m.name), h("time", { datetime: m.createdAt }, fmtDate(m.createdAt))),
                m.eventType && h("span", { class: "pill" }, m.eventType),
              ),
              h(
                "dl",
                { class: "message-meta" },
                h(
                  "div",
                  {},
                  h("dt", {}, "Telefon"),
                  h("dd", {}, h("a", { href: `tel:${m.phone.replace(/[^\d+]/g, "")}` }, m.phone)),
                ),
                m.email &&
                  h("div", {}, h("dt", {}, "E-posta"), h("dd", {}, h("a", { href: `mailto:${m.email}` }, m.email))),
                m.date &&
                  h(
                    "div",
                    {},
                    h("dt", {}, "Tarih"),
                    h(
                      "dd",
                      {},
                      new Date(m.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
                    ),
                  ),
                m.guests && h("div", {}, h("dt", {}, "Kişi sayısı"), h("dd", {}, m.guests)),
              ),
              m.message && h("p", { class: "message-text" }, m.message),
              h(
                "footer",
                {},
                h(
                  "a",
                  { class: "btn btn-whatsapp btn-sm", href: waLink(m), target: "_blank", rel: "noopener" },
                  ic("whatsapp"),
                  "WhatsApp'tan yanıtla",
                ),
                h(
                  "a",
                  { class: "btn btn-light btn-sm", href: `tel:${m.phone.replace(/[^\d+]/g, "")}` },
                  ic("phone"),
                  "Ara",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn-ghost btn-sm",
                    onclick: async () => {
                      try {
                        Object.assign(
                          m,
                          await api(`/api/messages/${m.id}`, { method: "PATCH", body: { read: !m.read } }),
                        );
                        render();
                        renderNav();
                      } catch (err) {
                        toast(err.message, "error");
                      }
                    },
                  },
                  m.read ? "Okunmadı yap" : "Okundu işaretle",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn-ghost btn-sm danger",
                    onclick: async () => {
                      if (!confirm(`${m.name} adlı kişinin mesajı silinsin mi?`)) return;
                      try {
                        await api(`/api/messages/${m.id}`, { method: "DELETE" });
                        state.messages = state.messages.filter((x) => x !== m);
                        render();
                        renderNav();
                        toast("Mesaj silindi.");
                      } catch (err) {
                        toast(err.message, "error");
                      }
                    },
                  },
                  "Sil",
                ),
              ),
            ),
          )
        : [
            h(
              "div",
              { class: "card empty-state" },
              ic("mail"),
              h(
                "p",
                {},
                messageFilter === "unread"
                  ? "Okunmamış mesaj yok."
                  : "Henüz mesaj yok. Sitedeki formdan gelen talepler burada listelenecek.",
              ),
            ),
          ]),
    );
  };
  render();
  return [
    h(
      "div",
      { class: "toolbar" },
      tabs,
      h(
        "button",
        { type: "button", class: "btn btn-light btn-sm", onclick: async () => (await loadMessages(), render()) },
        "Yenile",
      ),
    ),
    list,
  ];
}

/* ---------- Medya ---------- */

function renderMedia() {
  const grid = h("div", { class: "media-grid" }, h("p", { class: "empty" }, "Yükleniyor…"));
  const load = async () => {
    try {
      const { items } = await api("/api/media");
      fill(
        grid,
        ...(items.length
          ? items.map((item) =>
              h(
                "figure",
                { class: "media-item" },
                h(
                  "a",
                  { href: item.url, target: "_blank", rel: "noopener" },
                  h("img", { src: item.url, alt: item.name || "", loading: "lazy" }),
                ),
                h(
                  "figcaption",
                  {},
                  h("strong", { title: item.name }, item.name || item.key),
                  h(
                    "span",
                    {},
                    [
                      item.size && fmtSize(item.size),
                      item.uploadedAt && new Date(item.uploadedAt).toLocaleDateString("tr-TR"),
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  ),
                  h(
                    "div",
                    { class: "media-actions" },
                    item.inUse
                      ? h("span", { class: "pill" }, "Kullanımda")
                      : h("span", { class: "pill pill-muted" }, "Kullanılmıyor"),
                    h(
                      "button",
                      {
                        type: "button",
                        class: "btn btn-ghost btn-sm danger",
                        disabled: item.inUse,
                        title: item.inUse ? "Önce sitede kullanıldığı yerden kaldırıp kaydedin." : "",
                        onclick: async () => {
                          if (!confirm("Görsel kalıcı olarak silinsin mi?")) return;
                          try {
                            await api(`/api/media/${item.key}`, { method: "DELETE" });
                            toast("Görsel silindi.");
                            load();
                          } catch (err) {
                            toast(err.message, "error");
                          }
                        },
                      },
                      "Sil",
                    ),
                  ),
                ),
              ),
            )
          : [h("p", { class: "empty" }, "Henüz görsel yüklenmedi.")]),
      );
    } catch (err) {
      if (err.status !== 401) fill(grid, h("p", { class: "empty" }, err.message));
    }
  };
  load();
  return [
    isDirty() &&
      h(
        "p",
        { class: "notice" },
        'Kaydedilmemiş değişiklikleriniz var. "Kullanımda" bilgisi kayıtlı içeriğe göre hesaplanır.',
      ),
    h(
      "div",
      { class: "toolbar" },
      h(
        "button",
        {
          type: "button",
          class: "btn btn-primary",
          onclick: async () => {
            const files = await pickFiles({ multiple: true });
            for (const file of files) {
              try {
                await uploadImage(file);
              } catch (err) {
                toast(err.message, "error");
              }
            }
            if (files.length) load();
          },
        },
        ic("camera"),
        "Görsel yükle",
      ),
    ),
    grid,
  ];
}

/* ---------- Hesap ---------- */

function renderAccount() {
  const pw = { current: "", next: "", again: "" };
  const history = h("ul", { class: "history" }, h("li", { class: "empty" }, "Yükleniyor…"));

  api("/api/content/history")
    .then(({ versions }) =>
      fill(
        history,
        ...(versions.length
          ? versions.map((ts) =>
              h(
                "li",
                {},
                h("span", {}, fmtDate(ts)),
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn-ghost btn-sm",
                    onclick: async () => {
                      if (!confirm(`${fmtDate(ts)} tarihli sürüm geri yüklensin mi? Mevcut içerik de yedeklenir.`))
                        return;
                      try {
                        state.content = await api("/api/content/restore", { method: "POST", body: { timestamp: ts } });
                        state.savedJson = JSON.stringify(state.content);
                        markDirty();
                        toast("Sürüm geri yüklendi ve yayına alındı.", "success");
                        go("hesap");
                      } catch (err) {
                        toast(err.message, "error");
                      }
                    },
                  },
                  "Geri yükle",
                ),
              ),
            )
          : [h("li", { class: "empty" }, "Henüz yedek yok. Her kayıtta önceki hâl otomatik yedeklenir.")]),
      ),
    )
    .catch(() => {});

  const pwField = (key, label, autocomplete) =>
    h(
      "div",
      { class: "field" },
      h("label", { class: "field-label", for: `pw-${key}` }, label),
      h("input", { id: `pw-${key}`, type: "password", autocomplete, oninput: (e) => (pw[key] = e.target.value) }),
    );

  return [
    card(
      "Şifre değiştir",
      "En az 8 karakter. Şifre değişince diğer cihazlardaki oturumlar kapanır.",
      h(
        "form",
        {
          class: "form-grid",
          onsubmit: async (e) => {
            e.preventDefault();
            if (pw.next !== pw.again) return toast("Yeni şifreler eşleşmiyor.", "error");
            try {
              await api("/api/password", { method: "POST", body: { current: pw.current, next: pw.next } });
              e.target.reset();
              toast("Şifreniz değiştirildi.", "success");
            } catch (err) {
              toast(err.message, "error");
            }
          },
        },
        pwField("current", "Mevcut şifre", "current-password"),
        h("div"),
        pwField("next", "Yeni şifre", "new-password"),
        pwField("again", "Yeni şifre (tekrar)", "new-password"),
        h("div", { class: "is-wide" }, h("button", { class: "btn btn-primary", type: "submit" }, "Şifreyi değiştir")),
      ),
    ),
    card("Önceki sürümler", "Her kayıtta sitenin önceki hâli saklanır (son 20 kayıt).", history),
    card("Oturum", null, h("button", { type: "button", class: "btn btn-light", onclick: logout }, "Çıkış yap")),
  ];
}

/* ============================================================
   Kabuk: giriş ekranı, menü, kaydetme
   ============================================================ */

const app = document.getElementById("app");

function logoMark() {
  return h("span", {
    class: "brand-mark",
    html: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 16.5 18 25M24 15.5 21 25M30.5 20 25 25" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="14" cy="11" r="6" fill="#a29bfe"/><circle cx="24" cy="8.5" r="7" fill="#6c5ce7"/><circle cx="30.5" cy="16" r="4.6" fill="#ff7675"/><path d="M7.5 24.5h25l-3 10.6a2 2 0 0 1-1.9 1.4H12.4a2 2 0 0 1-1.9-1.4L7.5 24.5Z" fill="currentColor"/></svg>',
  });
}

function showLogin(message) {
  document.body.classList.remove("is-dirty");
  state.content = null;
  let password = "";
  const error = h("p", { class: "login-error", role: "alert" }, message || "");
  const button = h("button", { class: "btn btn-primary btn-block", type: "submit" }, "Giriş yap");
  app.className = "login";
  fill(
    app,
    h(
      "form",
      {
        class: "login-card",
        onsubmit: async (e) => {
          e.preventDefault();
          button.disabled = true;
          button.textContent = "Kontrol ediliyor…";
          error.textContent = "";
          try {
            await api("/api/login", { method: "POST", body: { password } });
            await startApp();
          } catch (err) {
            error.textContent = err.message;
            button.disabled = false;
            button.textContent = "Giriş yap";
          }
        },
      },
      logoMark(),
      h("h1", {}, "Yönetim Paneli"),
      h("p", { class: "login-sub" }, "Organizasyon Sepeti"),
      h(
        "div",
        { class: "field" },
        h("label", { class: "field-label", for: "login-password" }, "Şifre"),
        h("input", {
          id: "login-password",
          type: "password",
          autocomplete: "current-password",
          required: true,
          autofocus: true,
          oninput: (e) => (password = e.target.value),
        }),
      ),
      error,
      button,
      h("a", { class: "login-back", href: "/" }, "← Siteye dön"),
    ),
  );
  app.querySelector("input").focus();
}

async function logout() {
  if (isDirty() && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Çıkış yapılsın mı?")) return;
  await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
  showLogin();
}

let navEl;
let mainEl;

function renderNav() {
  if (!navEl) return;
  fill(
    navEl,
    ...NAV.map((item) => {
      if (item.group) return h("p", { class: "nav-group" }, item.group);
      const badge = item.badge?.();
      return h(
        "a",
        {
          href: `#${item.id}`,
          class: `nav-link${state.page === item.id ? " is-active" : ""}`,
          "aria-current": state.page === item.id ? "page" : null,
        },
        ic(item.icon),
        h("span", {}, item.title),
        badge ? h("em", { class: "badge" }, badge) : null,
      );
    }),
  );
}

function go(page) {
  location.hash = page;
}

function renderPage() {
  const page = PAGES[state.page] ? state.page : "panel";
  state.page = page;
  const def = PAGES[page];
  document.body.classList.remove("nav-open");
  renderNav();
  fill(
    mainEl,
    h(
      "header",
      { class: "page-head" },
      h("div", {}, h("h1", {}, def.title), def.description && h("p", {}, def.description)),
    ),
    h("div", { class: "page-body" }, def.render()),
  );
  mainEl.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function save() {
  if (!isDirty() || state.saving) return;
  state.saving = true;
  document.body.classList.add("is-saving");
  try {
    state.content = await api("/api/content", { method: "PUT", body: state.content });
    state.savedJson = JSON.stringify(state.content);
    toast("Kaydedildi. Değişiklikler sitede yayında.", "success");
    renderPage();
  } catch (err) {
    if (err.status !== 401) toast(err.message, "error");
  } finally {
    state.saving = false;
    document.body.classList.remove("is-saving");
    markDirty();
  }
}

function discard() {
  if (!confirm("Kaydedilmemiş tüm değişiklikler geri alınsın mı?")) return;
  state.content = JSON.parse(state.savedJson);
  markDirty();
  renderPage();
}

async function startApp() {
  state.content = await api("/api/content");
  state.savedJson = JSON.stringify(state.content);
  state.page = location.hash.slice(1) || "panel";

  navEl = h("nav", { class: "nav", "aria-label": "Panel menüsü" });
  mainEl = h("main", { class: "main", tabindex: "-1" });

  app.className = "shell";
  fill(
    app,
    h(
      "aside",
      { class: "sidebar" },
      h(
        "a",
        { class: "brand", href: "#panel" },
        logoMark(),
        h("span", {}, h("strong", {}, "Organizasyon Sepeti"), h("small", {}, "Yönetim paneli")),
      ),
      navEl,
      h(
        "div",
        { class: "sidebar-foot" },
        h(
          "a",
          { class: "btn btn-light btn-block", href: "/", target: "_blank", rel: "noopener" },
          "Siteyi görüntüle ↗",
        ),
        h("button", { type: "button", class: "link-btn", onclick: logout }, "Çıkış yap"),
      ),
    ),
    h(
      "div",
      { class: "topbar" },
      h(
        "button",
        {
          type: "button",
          class: "icon-btn",
          "aria-label": "Menü",
          onclick: () => document.body.classList.toggle("nav-open"),
        },
        ic("menu"),
      ),
      h("a", { class: "brand", href: "#panel" }, logoMark(), h("strong", {}, "Panel")),
      h(
        "a",
        { class: "icon-btn", href: "/", target: "_blank", rel: "noopener", "aria-label": "Siteyi görüntüle" },
        ic("arrow"),
      ),
    ),
    h("div", { class: "scrim", onclick: () => document.body.classList.remove("nav-open") }),
    mainEl,
    h(
      "div",
      { class: "savebar", role: "region", "aria-label": "Kaydet" },
      h("span", {}, "Kaydedilmemiş değişiklikler var"),
      h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: discard }, "Vazgeç"),
      h("button", { type: "button", class: "btn btn-primary btn-sm save-btn", onclick: save }, "Kaydet ve yayınla"),
    ),
  );
  renderPage();
  loadMessages();
  loadSummary();
}

window.addEventListener("hashchange", () => {
  if (!state.content) return;
  state.page = location.hash.slice(1) || "panel";
  renderPage();
});

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && state.content) {
    e.preventDefault();
    save();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (isDirty()) e.preventDefault();
});

(async () => {
  try {
    const { authenticated } = await api("/api/me");
    if (authenticated) await startApp();
    else showLogin();
  } catch (err) {
    showLogin(err.message);
  }
})();
