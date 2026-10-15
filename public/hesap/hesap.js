// Üye (ilan veren firma) hesabı: giriş/kayıt, ilanlarım, ilan formu ve profil.
import { CITY_NAMES, districtsOf } from "/assets/js/locations.js";
import {
  api,
  fill,
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
const state = { user: null, listings: [], categories: [], siteName: "Organizasyon Sepeti", returnTo: "" };
const MAX_IMAGES = 12;
const STATUS = {
  pending: ["Onay bekliyor", "warn"],
  active: ["Yayında", "ok"],
  rejected: ["Reddedildi", "bad"],
  passive: ["Yayında değil", "muted"],
};
const PRICE_NOTES = ["başlayan fiyatlarla", "paket fiyatı", "kişi başı", "saatlik", "günlük"];

const go = (hash) => (location.hash === `#${hash}` ? route() : (location.hash = hash));
const categoryName = (id) => state.categories.find((c) => c.id === id)?.name || "Kategori yok";
const listingUrl = (x) => `/ilan/${x.slug}-${x.id}`;

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
}

/* ---------- Ortak form parçaları ---------- */

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

/* ---------- Giriş / kayıt ---------- */

function renderAuth(mode) {
  document.title = `${mode === "login" ? "Giriş yap" : "Üye ol"} | ${state.siteName}`;
  const status = statusLine();
  const submit = h(
    "button",
    { class: "btn btn-primary btn-block", type: "submit" },
    mode === "login" ? "Giriş yap" : "Ücretsiz üye ol",
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
              ? `Hoş geldiniz, ${state.user.name.split(" ")[0]}!`
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
    h("h1", {}, mode === "login" ? "Firma girişi" : "Ücretsiz üye olun"),
    h(
      "p",
      { class: "auth-sub" },
      state.returnTo === "yeni-ilan"
        ? "İlan vermek için giriş yapın ya da birkaç saniyede ücretsiz üye olun."
        : mode === "login"
          ? "İlanlarınızı yönetmek için giriş yapın."
          : "Üyelik ve ilan vermek ücretsizdir.",
    ),
    mode === "login" ? loginFields() : registerFields(),
    status,
    submit,
    mode === "login"
      ? h(
          "p",
          { class: "auth-alt" },
          "Şifrenizi mi unuttunuz? ",
          h("a", { href: "/iletisim" }, "Bize yazın"),
          ", hesabınızı doğrulayıp yeni şifre iletelim.",
        )
      : null,
    h(
      "p",
      { class: "auth-switch" },
      mode === "login" ? "Henüz üye değil misiniz? " : "Zaten üye misiniz? ",
      h("a", { href: mode === "login" ? "#kayit" : "#giris" }, mode === "login" ? "Ücretsiz üye olun" : "Giriş yapın"),
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
        h("p", { class: "eyebrow" }, "Organizasyon firmaları için"),
        h("h2", {}, "Hizmetlerinizi organizasyon arayan kişilere ulaştırın"),
        h(
          "ul",
          {},
          [
            "Üyelik ve ilan vermek tamamen ücretsiz",
            "Fotoğraflı, detaylı ilan sayfası",
            "Müşteriler sizi doğrudan telefon ve WhatsApp'tan arar",
            "İlanlarınız kontrol edildikten sonra yayına girer",
          ].map((t) => h("li", {}, ic("check"), h("span", {}, t))),
        ),
      ),
      form,
    ),
  );
  form.querySelector("input")?.focus();
}

/* ---------- Hesap kabuğu ---------- */

function shell(page) {
  const tab = (hash, label, icon) =>
    h(
      "a",
      {
        href: `#${hash}`,
        class: `acc-tab${page === hash ? " is-active" : ""}`,
        "aria-current": page === hash ? "page" : null,
      },
      ic(icon),
      h("span", {}, label),
    );
  const view = h("div", { class: "acc-view", id: "view" });
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
          h(
            "span",
            { class: "vendor-avatar", "aria-hidden": "true" },
            state.user.company.slice(0, 1).toLocaleUpperCase("tr"),
          ),
          h(
            "div",
            {},
            h("p", { class: "eyebrow" }, "Firma hesabı"),
            h("h1", {}, state.user.company),
            h("p", {}, state.user.name, " · ", state.user.email),
          ),
        ),
        h(
          "nav",
          { class: "acc-tabs", "aria-label": "Hesap menüsü" },
          tab("ilanlarim", "İlanlarım", "image"),
          tab("yeni-ilan", "Yeni ilan", "plus"),
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

function renderListings(view) {
  document.title = `İlanlarım | ${state.siteName}`;
  const counts = Object.fromEntries(
    Object.keys(STATUS).map((s) => [s, state.listings.filter((x) => x.status === s).length]),
  );

  const row = (x) => {
    const [label, tone] = STATUS[x.status];
    const actions = [];
    if (x.status === "active")
      actions.push(
        h("a", { class: "btn btn-light btn-sm", href: listingUrl(x), target: "_blank" }, ic("eye"), "Görüntüle"),
      );
    actions.push(h("a", { class: "btn btn-light btn-sm", href: `#duzenle/${x.id}` }, ic("edit"), "Düzenle"));
    if (x.status === "active" || x.status === "pending") actions.push(actionButton(x, "Yayından kaldır", false));
    if (x.status === "passive") actions.push(actionButton(x, "Yeniden yayınla", true));
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
          h("span", { class: "ml-date" }, `Son güncelleme: ${fmtDay(x.updatedAt)}`),
        ),
        h("h3", {}, x.title),
        h(
          "p",
          { class: "ml-meta" },
          [
            categoryName(x.category),
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
        x.status === "pending"
          ? h("p", { class: "ml-note" }, "İlanınız kontrol ediliyor. Onaylandığında sitede yayına girecek.")
          : null,
        h("div", { class: "ml-actions" }, actions),
      ),
    );
  };

  fill(
    view,
    h(
      "div",
      { class: "acc-toolbar" },
      h(
        "p",
        { class: "acc-counts" },
        Object.entries(STATUS)
          .filter(([s]) => counts[s])
          .map(([s, [label, tone]]) => h("span", { class: `status status-${tone}` }, `${label}: ${counts[s]}`)),
      ),
      h("a", { class: "btn btn-primary", href: "#yeni-ilan" }, ic("plus"), "Yeni ilan ver"),
    ),
    state.listings.length
      ? h("div", { class: "my-listings" }, state.listings.map(row))
      : h(
          "div",
          { class: "empty-state is-compact" },
          h("span", { class: "empty-icon" }, ic("balloon")),
          h("h2", {}, "Henüz ilanınız yok"),
          h("p", {}, "Hizmetlerinizi fotoğraflarıyla anlatan ilk ilanınızı oluşturun. Kontrolden sonra yayına girer."),
          h("a", { class: "btn btn-primary", href: "#yeni-ilan" }, ic("plus"), "İlk ilanımı oluştur"),
        ),
  );
}

function actionButton(x, label, active) {
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

/* ---------- İlan formu ---------- */

async function renderEditor(view, id) {
  document.title = `${id ? "İlanı düzenle" : "Yeni ilan"} | ${state.siteName}`;
  let listing = {
    title: "",
    category: "",
    city: "",
    district: "",
    priceMin: "",
    priceNote: "",
    description: "",
    images: [],
    phone: state.user.phone,
    whatsapp: true,
    instagram: "",
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
    option("", "Kategori seçin", !listing.category),
    state.categories.map((c) => option(c.id, c.name, c.id === listing.category)),
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

  const description = h("textarea", {
    name: "description",
    rows: 9,
    maxlength: 5000,
    required: true,
    value: listing.description,
    placeholder: "Sunduğunuz hizmeti, pakete dahil olanları, kurulum ve teslim detaylarını anlatın.",
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

  // Fotoğraflar
  const gallery = h("div", { class: "photo-grid" });
  const photoStatus = h("span", { class: "photo-status" });
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
                onclick: () => (images.splice(i - 1, 0, images.splice(i, 1)[0]), renderPhotos()),
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
                onclick: () => (images.splice(i + 1, 0, images.splice(i, 1)[0]), renderPhotos()),
              },
              ic("chevron"),
            ),
            h(
              "button",
              {
                type: "button",
                class: "icon-btn danger",
                "aria-label": "Kaldır",
                onclick: () => (images.splice(i, 1), renderPhotos()),
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

  const status = statusLine();
  const submit = h(
    "button",
    { class: "btn btn-primary", type: "submit" },
    id ? "Kaydet ve onaya gönder" : "İlanı onaya gönder",
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
          (!category.value && [category, "Lütfen bir kategori seçin."]) ||
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
          city: city.value,
          district: district.value,
          description: description.value,
          priceMin: price.value,
          priceNote: priceNote.value,
          phone: phone.value,
          whatsapp: whatsapp.checked,
          instagram: instagram.value,
          images,
        };
        try {
          await api(id ? `/api/account/listings/${id}` : "/api/account/listings", {
            method: id ? "PUT" : "POST",
            body,
          });
          await refreshMe();
          toast(
            id
              ? "Değişiklikler kaydedildi, ilan tekrar onaya gönderildi."
              : "İlanınız alındı! Kontrol edildikten sonra yayına girecek.",
            "success",
          );
          go("ilanlarim");
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
        field("Kategori", category),
        h("div"),
        field("İl", city),
        field("İlçe", district, { help: "Tüm ilde hizmet veriyorsanız boş bırakın." }),
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
      h("h2", {}, "Fiyat"),
      h(
        "div",
        { class: "form-grid" },
        field("Fiyat (₺)", price, { help: 'Boş bırakırsanız "Fiyat sorunuz" yazar.' }),
        field("Fiyat notu", priceNote),
      ),
    ),
    h(
      "section",
      { class: "panel" },
      h("h2", {}, "İletişim"),
      h(
        "div",
        { class: "form-grid" },
        field("Telefon", phone, { help: 'Ziyaretçiler "Telefonu göster" butonuna basınca görür.' }),
        field("Instagram (isteğe bağlı)", instagram),
        h(
          "label",
          { class: "check field-full" },
          whatsapp,
          h("span", {}, "Bu numara WhatsApp'ta kullanılıyor (ilanda WhatsApp butonu çıkar)"),
        ),
      ),
    ),
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

/* ---------- Profil ---------- */

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
      "Hesabınız, tüm ilanlarınız ve fotoğraflarınız kalıcı olarak silinir. Bu işlem geri alınamaz.",
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

  fill(view, h("h2", { class: "acc-title" }, "Profil"), profile, password, remove);
}

/* ---------- Yönlendirme ---------- */

function route() {
  const [page, param] = location.hash.slice(1).split("/");
  window.scrollTo(0, 0);
  if (!state.user) {
    if (page === "yeni-ilan") state.returnTo = "yeni-ilan";
    return renderAuth(page === "kayit" ? "register" : "login");
  }
  if (page === "giris" || page === "kayit" || !page) return go("ilanlarim");
  const view = shell(page === "duzenle" ? "ilanlarim" : page);
  if (page === "yeni-ilan") return renderEditor(view);
  if (page === "duzenle") return renderEditor(view, param);
  if (page === "profil") return renderProfile(view);
  return renderListings(view);
}

window.addEventListener("hashchange", route);

(async () => {
  try {
    const content = await api("/api/content");
    state.categories = content.categories;
    state.siteName = content.settings.siteName;
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
