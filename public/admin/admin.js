import { ICONS, icon } from "/assets/js/icons.js";

/* ============================================================
   Yardımcılar
   ============================================================ */

// Güvenli DOM oluşturucu: metinler her zaman textContent olarak eklenir.
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "html")
      el.innerHTML = value; // yalnızca güvenilir (ikon) içerik
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "value" || key === "checked" || key === "selected" || key === "open") el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

// replaceChildren, null/false değerleri "null" yazısına çevirdiği için önce temizlenir.
const fill = (el, ...kids) =>
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
const ic = (name, cls = "icon") => h("span", { class: "icon-wrap", html: icon(name, cls), "aria-hidden": "true" });
const newId = () => Math.random().toString(16).slice(2, 12).padEnd(10, "0");
const clone = (v) => structuredClone(v);
const fmtDate = (iso) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const fmtSize = (bytes) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function toast(message, type = "info") {
  const el = h("div", { class: `toast toast-${type}`, role: type === "error" ? "alert" : "status" }, message);
  document.getElementById("toasts").append(el);
  setTimeout(() => el.classList.add("is-leaving"), 3600);
  setTimeout(() => el.remove(), 4000);
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(path, { method = "GET", body, headers = {} } = {}) {
  const isJson = body !== undefined && !(body instanceof Blob);
  const res = await fetch(path, {
    method,
    headers: isJson ? { "Content-Type": "application/json", ...headers } : headers,
    body: isJson ? JSON.stringify(body) : body,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/login") {
    showLogin("Oturumunuz sona erdi, lütfen tekrar giriş yapın.");
    throw new ApiError(401, data.error || "Oturum sona erdi.");
  }
  if (!res.ok) throw new ApiError(res.status, data.error || "İşlem başarısız oldu.");
  return data;
}

/* ============================================================
   Durum
   ============================================================ */

const state = {
  content: null,
  savedJson: "",
  messages: [],
  page: "panel",
  saving: false,
};

const isDirty = () => state.content && JSON.stringify(state.content) !== state.savedJson;

function markDirty() {
  document.body.classList.toggle("is-dirty", isDirty());
}

const TEMPLATES = {
  services: { title: "", text: "", icon: "balloon", image: "", price: "" },
  steps: { title: "", text: "" },
  packages: { name: "", price: "", note: "", features: [], featured: false },
  stats: { value: "", label: "" },
  gallery: { image: "", caption: "", category: "" },
  testimonials: { name: "", event: "", text: "", rating: 5 },
  faq: { q: "", a: "" },
};

const THEMES = [
  ["rose", "Gül kurusu", ["#a8475f", "#eaa9b8", "#dcb67e"]],
  ["champagne", "Şampanya", ["#96682d", "#ead2a8", "#cfa66c"]],
  ["lavender", "Lavanta", ["#6c529d", "#c9b6e8", "#f4dbe7"]],
  ["sage", "Adaçayı", ["#4b705d", "#b9d0be", "#f2ddcc"]],
];

/* ============================================================
   Görsel yükleme
   ============================================================ */

// Telefondan gelen büyük fotoğrafları yüklemeden önce küçültür (en fazla 2000 px, WebP/JPEG).
async function prepareImage(file) {
  if (file.type === "image/gif") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));
  let blob = await toBlob("image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.86);
  return blob && (blob.size < file.size || scale < 1) ? blob : file;
}

async function uploadImage(file) {
  const prepared = await prepareImage(file);
  if (prepared.size > 5 * 1024 * 1024) throw new Error(`${file.name}: görsel 5 MB'tan büyük.`);
  const result = await api("/api/media", {
    method: "POST",
    body: prepared,
    headers: { "Content-Type": prepared.type || file.type, "X-File-Name": encodeURIComponent(file.name) },
  });
  return result.url;
}

function pickFiles({ multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept: "image/*", multiple });
    input.addEventListener("change", () => resolve([...input.files]));
    input.click();
  });
}

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
      case "theme":
        return themePicker(obj, def);
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
  const labelTag = ["text", "textarea", "select", undefined].includes(def.type) ? "label" : "div";
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

function themePicker(obj, def) {
  const wrap = h("div", { class: "theme-picker" });
  const render = () =>
    fill(
      wrap,
      ...THEMES.map(([value, label, colors]) =>
        h(
          "button",
          {
            type: "button",
            class: `theme-option${obj[def.key] === value ? " is-active" : ""}`,
            onclick: () => {
              setValue(obj, def.key, value);
              render();
            },
          },
          h(
            "span",
            { class: "swatches" },
            colors.map((c) => h("span", { style: `background:${c}` })),
          ),
          label,
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

const sectionCard = (key) =>
  card(
    "Bölüm başlığı",
    "Bu bölümün sitedeki başlık ve açıklaması.",
    formGrid(state.content.sections[key], SECTION_FIELDS),
  );

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
  { id: "mesajlar", title: "Mesajlar", icon: "mail", badge: () => state.messages.filter((m) => !m.read).length },
  { group: "Site içeriği" },
  { id: "anasayfa", title: "Karşılama alanı", icon: "star" },
  { id: "hizmetler", title: "Hizmetler", icon: "balloon" },
  { id: "surec", title: "Çalışma adımları", icon: "check" },
  { id: "paketler", title: "Paketler", icon: "gift" },
  { id: "galeri", title: "Galeri", icon: "camera" },
  { id: "hakkimizda", title: "Hakkımızda", icon: "heart" },
  { id: "yorumlar", title: "Yorumlar", icon: "quote" },
  { id: "sss", title: "Sıkça sorulanlar", icon: "flower" },
  { group: "Ayarlar" },
  { id: "iletisim", title: "İletişim bilgileri", icon: "phone" },
  { id: "gorunum", title: "Görünüm & SEO", icon: "crown" },
  { id: "medya", title: "Medya kütüphanesi", icon: "party" },
  { id: "hesap", title: "Hesap & yedekler", icon: "clock" },
];

const PAGES = {
  panel: {
    title: "Genel bakış",
    render: renderDashboard,
  },

  mesajlar: {
    title: "Mesajlar",
    description: "Sitedeki teklif formundan gelen talepler.",
    render: renderMessages,
  },

  anasayfa: {
    title: "Karşılama alanı",
    description: "Ziyaretçilerin siteye girince ilk gördüğü bölüm.",
    render: () => [
      card(
        "Metinler",
        null,
        formGrid(state.content.hero, [
          { key: "eyebrow", label: "Üst satır", wide: true, help: "Başlığın üstündeki küçük, büyük harfli satır." },
          { key: "title", label: "Başlık" },
          { key: "highlight", label: "Vurgulu başlık", help: "Başlığın altında italik ve renkli görünen kısım." },
          { key: "subtitle", label: "Açıklama", type: "textarea", rows: 3, wide: true },
          { key: "primaryCta", label: "Ana buton yazısı" },
          { key: "secondaryCta", label: "İkinci buton yazısı" },
        ]),
      ),
      card(
        "Görsel ve etiketler",
        null,
        formGrid(state.content.hero, [
          {
            key: "image",
            label: "Kemer görseli",
            type: "image",
            help: "Dikey (4:5) bir fotoğraf en iyi sonucu verir. Boş bırakılırsa balon çizimi görünür.",
          },
          {
            key: "badges",
            label: "Süzülen etiketler",
            type: "list",
            placeholder: "Örn. Kişiye özel tasarım",
            help: "Görselin çevresindeki küçük kartlar (ilk 3 tanesi gösterilir).",
          },
        ]),
      ),
    ],
  },

  hizmetler: {
    title: "Hizmetler",
    description: "Sunduğunuz organizasyon türleri. Sıralamayı oklarla değiştirebilirsiniz.",
    render: () => [
      sectionCard("services"),
      card(
        "Hizmet listesi",
        "Görsel eklemezseniz seçtiğiniz ikon gösterilir.",
        listEditor("services", {
          label: "Hizmet",
          titleOf: (s) => s.title,
          fields: [
            { key: "title", label: "Hizmet adı" },
            {
              key: "price",
              label: "Fiyat (isteğe bağlı)",
              placeholder: "Örn. 3.500 ₺'den başlayan",
              help: "Boş bırakılırsa fiyat gösterilmez.",
            },
            { key: "text", label: "Kısa açıklama", type: "textarea", rows: 3, wide: true },
            { key: "icon", label: "İkon", type: "icon", wide: true },
            { key: "image", label: "Görsel (isteğe bağlı)", type: "image", wide: true },
          ],
        }),
      ),
    ],
  },

  surec: {
    title: "Çalışma adımları",
    description: '"Nasıl çalışıyoruz?" bölümündeki numaralı adımlar.',
    render: () => [
      sectionCard("process"),
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

  paketler: {
    title: "Paketler",
    description: 'Fiyat alanını boş bırakırsanız "Size özel teklif" yazar.',
    render: () => [
      sectionCard("packages"),
      card(
        "Paket listesi",
        null,
        listEditor("packages", {
          label: "Paket",
          titleOf: (p) => p.name,
          fields: [
            { key: "name", label: "Paket adı" },
            { key: "price", label: "Fiyat", placeholder: "Örn. 4.500 ₺" },
            { key: "note", label: "Etiket", placeholder: "Örn. En çok tercih edilen" },
            { key: "featured", label: "Öne çıkar", type: "toggle", toggleLabel: "Koyu renkli, vurgulu kart" },
            {
              key: "features",
              label: "Pakete dahil olanlar",
              type: "list",
              wide: true,
              placeholder: "Örn. Balon takı",
            },
          ],
        }),
      ),
    ],
  },

  galeri: {
    title: "Galeri",
    description: "Organizasyon fotoğraflarınız. Birden fazla fotoğrafı aynı anda seçebilirsiniz.",
    render: () => [
      sectionCard("gallery"),
      card(
        "Fotoğraflar",
        "Kategori yazarsanız sitede filtre düğmeleri çıkar (örn. Doğum günü, Nişan).",
        galleryEditor(),
      ),
    ],
  },

  hakkimizda: {
    title: "Hakkımızda",
    render: () => [
      card(
        "Metin ve görsel",
        null,
        formGrid(state.content.sections.about, [
          { key: "eyebrow", label: "Üst başlık" },
          { key: "title", label: "Başlık" },
          {
            key: "text",
            label: "Metin",
            type: "textarea",
            rows: 8,
            wide: true,
            help: "Paragrafları boş bir satırla ayırın.",
          },
          { key: "image", label: "Görsel", type: "image", wide: true, help: "Boş bırakılırsa logonuz gösterilir." },
        ]),
      ),
      card(
        "Rakamlar (isteğe bağlı)",
        'Örn. "300+" / "Mutlu kutlama". Yalnızca gerçek rakamlar ekleyin.',
        listEditor("stats", {
          label: "Rakam",
          titleOf: (s) => [s.value, s.label].filter(Boolean).join(" · "),
          emptyText: "Rakam eklenmedi; bu alan sitede gizli.",
          fields: [
            { key: "value", label: "Değer", placeholder: "Örn. 300+" },
            { key: "label", label: "Açıklama", placeholder: "Örn. Mutlu kutlama" },
          ],
        }),
      ),
    ],
  },

  yorumlar: {
    title: "Yorumlar",
    description: "Müşterilerinizin size ilettiği gerçek yorumlar. Liste boşsa bölüm sitede görünmez.",
    render: () => [
      sectionCard("testimonials"),
      card(
        "Yorum listesi",
        null,
        listEditor("testimonials", {
          label: "Yorum",
          titleOf: (t) => t.name,
          emptyText: "Henüz yorum eklenmedi; bu bölüm sitede gizli.",
          fields: [
            { key: "name", label: "Müşteri adı", placeholder: "Örn. Ayşe K." },
            { key: "event", label: "Organizasyon", placeholder: "Örn. Nişan organizasyonu" },
            {
              key: "rating",
              label: "Puan",
              type: "select",
              number: true,
              options: [5, 4, 3, 2, 1].map((n) => [n, "★".repeat(n)]),
            },
            { key: "text", label: "Yorum", type: "textarea", rows: 3, wide: true },
          ],
        }),
      ),
    ],
  },

  sss: {
    title: "Sıkça sorulanlar",
    render: () => [
      sectionCard("faq"),
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

  iletisim: {
    title: "İletişim bilgileri",
    description: "Boş bıraktığınız bilgiler sitede gösterilmez.",
    render: () => [
      card(
        "Telefon ve WhatsApp",
        null,
        formGrid(state.content.settings, [
          { key: "phone", label: "Telefon", inputType: "tel", placeholder: "0532 000 00 00" },
          {
            key: "whatsapp",
            label: "WhatsApp numarası",
            inputType: "tel",
            placeholder: "0532 000 00 00",
            help: "Doluysa sitede yeşil WhatsApp butonu çıkar.",
          },
          {
            key: "whatsappMessage",
            label: "WhatsApp hazır mesajı",
            wide: true,
            help: "Ziyaretçi butona basınca mesaj kutusuna yazılı gelen metin.",
          },
        ]),
      ),
      card(
        "Diğer bilgiler",
        null,
        formGrid(state.content.settings, [
          { key: "email", label: "E-posta", inputType: "email" },
          { key: "workingHours", label: "Çalışma saatleri", placeholder: "Örn. Her gün 09:00 – 21:00" },
          { key: "address", label: "Adres", wide: true, help: "Sitede Google Haritalar bağlantısı olarak gösterilir." },
          {
            key: "serviceArea",
            label: "Hizmet bölgesi",
            wide: true,
            placeholder: "Örn. İstanbul Anadolu ve Avrupa yakası",
          },
        ]),
      ),
      card(
        "Sosyal medya",
        "Kullanıcı adı (@ile ya da @'siz) veya tam bağlantı yazabilirsiniz.",
        formGrid(state.content.settings, [
          { key: "instagram", label: "Instagram", placeholder: "@organizasyonsepeti" },
          { key: "tiktok", label: "TikTok" },
          { key: "facebook", label: "Facebook" },
        ]),
      ),
      sectionCard("contact"),
    ],
  },

  gorunum: {
    title: "Görünüm & SEO",
    render: () => [
      card(
        "Marka",
        null,
        formGrid(state.content.settings, [
          { key: "siteName", label: "Site adı" },
          { key: "tagline", label: "Kısa slogan", help: "Alt bilgide görünür." },
          { key: "theme", label: "Renk teması", type: "theme", wide: true },
        ]),
      ),
      card(
        "Arama motorları ve paylaşım",
        "Google sonuçlarında ve WhatsApp/Instagram'da bağlantı paylaşıldığında görünen bilgiler.",
        formGrid(state.content.settings, [
          { key: "seoTitle", label: "Sayfa başlığı", wide: true, help: "60 karakter civarı idealdir." },
          {
            key: "seoDescription",
            label: "Açıklama",
            type: "textarea",
            rows: 3,
            wide: true,
            help: "150–160 karakter civarı idealdir.",
          },
          {
            key: "ogImage",
            label: "Paylaşım görseli",
            type: "image",
            wide: true,
            help: "Yatay (1200×630) bir görsel önerilir. Boşsa karşılama görseli kullanılır.",
          },
          { key: "siteUrl", label: "Site adresi", wide: true, inputType: "url" },
        ]),
      ),
    ],
  },

  medya: {
    title: "Medya kütüphanesi",
    description: "Yüklediğiniz tüm görseller. Sitede kullanılanlar silinemez.",
    render: renderMedia,
  },

  hesap: {
    title: "Hesap & yedekler",
    render: renderAccount,
  },
};

/* ---------- Genel bakış ---------- */

function renderDashboard() {
  const c = state.content;
  const s = c.settings;
  const unread = state.messages.filter((m) => !m.read).length;
  const photos = c.gallery.filter((g) => g.image).length;
  const tasks = [
    [Boolean(s.phone || s.whatsapp), "Telefon veya WhatsApp numarası ekleyin", "iletisim"],
    [Boolean(s.instagram), "Instagram hesabınızı ekleyin", "iletisim"],
    [Boolean(c.hero.image), "Karşılama alanına bir fotoğraf koyun", "anasayfa"],
    [photos >= 6, `Galeriye en az 6 fotoğraf yükleyin (şu an ${photos})`, "galeri"],
    [c.services.some((x) => x.image), "Hizmetlere fotoğraf ekleyin", "hizmetler"],
    [c.testimonials.length > 0, "Müşteri yorumlarından birkaçını ekleyin", "yorumlar"],
  ];
  const done = tasks.filter(([ok]) => ok).length;

  const stat = (value, label, page) =>
    h(
      "button",
      { type: "button", class: "stat", onclick: () => go(page) },
      h("strong", {}, value),
      h("span", {}, label),
    );

  return [
    h(
      "div",
      { class: "stats-row" },
      stat(unread, "Okunmamış mesaj", "mesajlar"),
      stat(state.messages.length, "Toplam talep", "mesajlar"),
      stat(c.services.length, "Hizmet", "hizmetler"),
      stat(photos, "Galeri fotoğrafı", "galeri"),
    ),
    h(
      "div",
      { class: "dash-grid" },
      card(
        "Siteyi tamamlayın",
        `${done} / ${tasks.length} adım tamamlandı`,
        h("div", { class: "progress" }, h("span", { style: `width:${(done / tasks.length) * 100}%` })),
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
      card(
        "Son talepler",
        null,
        state.messages.length
          ? h(
              "ul",
              { class: "recent" },
              state.messages
                .slice(0, 5)
                .map((m) =>
                  h(
                    "li",
                    {},
                    h(
                      "button",
                      { type: "button", onclick: () => go("mesajlar") },
                      h("strong", {}, m.name),
                      h("span", {}, [m.eventType, fmtDate(m.createdAt)].filter(Boolean).join(" · ")),
                      !m.read && h("em", {}, "Yeni"),
                    ),
                  ),
                ),
            )
          : h("p", { class: "empty" }, "Henüz form talebi yok. Gelen talepler burada görünecek."),
      ),
    ),
  ];
}

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

/* ---------- Galeri ---------- */

function galleryEditor() {
  const wrap = h("div", { class: "gallery-editor" });
  const items = state.content.gallery;
  const categories = h("datalist", { id: "gallery-categories" });

  const render = () => {
    fill(empty, items.length ? null : "Galeri boş; bu bölüm sitede gizli. İlk fotoğraflarınızı yükleyin.");
    fill(
      categories,
      ...[...new Set(items.map((g) => g.category).filter(Boolean))].map((c) => h("option", { value: c })),
    );
    fill(
      grid,
      ...items.map((item, i) =>
        h(
          "figure",
          { class: "g-card" },
          h(
            "div",
            { class: "g-thumb" },
            h("img", { src: item.image, alt: "", loading: "lazy" }),
            h(
              "div",
              { class: "g-actions" },
              h(
                "button",
                {
                  type: "button",
                  class: "icon-btn",
                  "aria-label": "Sola taşı",
                  disabled: i === 0,
                  onclick: () => (items.splice(i - 1, 0, items.splice(i, 1)[0]), markDirty(), render()),
                },
                ic("chevron", "icon rot-left"),
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "icon-btn",
                  "aria-label": "Sağa taşı",
                  disabled: i === items.length - 1,
                  onclick: () => (items.splice(i + 1, 0, items.splice(i, 1)[0]), markDirty(), render()),
                },
                ic("chevron"),
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "icon-btn danger",
                  "aria-label": "Galeriden kaldır",
                  onclick: () => (items.splice(i, 1), markDirty(), render()),
                },
                ic("close"),
              ),
            ),
          ),
          h("input", {
            value: item.caption,
            placeholder: "Açıklama (isteğe bağlı)",
            "aria-label": "Açıklama",
            oninput: (e) => setValue(item, "caption", e.target.value),
          }),
          h("input", {
            value: item.category,
            placeholder: "Kategori",
            list: "gallery-categories",
            "aria-label": "Kategori",
            oninput: (e) => setValue(item, "category", e.target.value),
            onchange: render,
          }),
        ),
      ),
    );
  };

  const status = h("span", { class: "upload-status" });
  const uploadBtn = h(
    "button",
    {
      type: "button",
      class: "btn btn-primary",
      onclick: async () => {
        const files = await pickFiles({ multiple: true });
        if (!files.length) return;
        uploadBtn.disabled = true;
        let ok = 0;
        for (const [n, file] of files.entries()) {
          status.textContent = `Yükleniyor ${n + 1} / ${files.length}…`;
          try {
            items.push({ id: newId(), image: await uploadImage(file), caption: "", category: "" });
            ok++;
            markDirty();
            render();
          } catch (err) {
            toast(err.message, "error");
          }
        }
        uploadBtn.disabled = false;
        status.textContent = "";
        if (ok) toast(`${ok} fotoğraf eklendi. Yayına almak için Kaydet'e basın.`, "success");
      },
    },
    ic("camera"),
    "Fotoğraf yükle",
  );

  const grid = h("div", { class: "g-grid" });
  const empty = h("p", { class: "empty" });
  render();
  wrap.append(h("div", { class: "toolbar" }, uploadBtn, status), categories, grid, empty);
  return wrap;
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
    html: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 16.5 18 25M24 15.5 21 25M30.5 20 25 25" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="14" cy="11" r="6" fill="#eaa9b8"/><circle cx="24" cy="8.5" r="7" fill="#a8475f"/><circle cx="30.5" cy="16" r="4.6" fill="#dcb67e"/><path d="M7.5 24.5h25l-3 10.6a2 2 0 0 1-1.9 1.4H12.4a2 2 0 0 1-1.9-1.4L7.5 24.5Z" fill="currentColor"/></svg>',
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
  loadMessages().then(() => state.page === "panel" && renderPage());
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
