const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Uygulama (PWA): çevrimdışı destek ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

/* ---------- Ziyaret istatistiği (çerezsiz; yönetici kendi cihazında kapatabilir) ---------- */

(() => {
  try {
    if (localStorage.getItem("os_notrack") === "1") return;
  } catch {
    // depolama kapalıysa yine say
  }
  const params = new URLSearchParams(location.search);
  fetch("/api/v1/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: location.pathname,
      ref: document.referrer,
      utm: params.get("utm_source") || params.get("kaynak") || "",
      q: location.pathname === "/ilanlar" ? params.get("q") || "" : "",
    }),
    keepalive: true,
  }).catch(() => {});
})();

/* ---------- Üst menü ---------- */

const header = $(".site-header");
if (header && !header.classList.contains("is-solid")) {
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

const menu = $("#menu");
const toggle = $(".menu-toggle");
const setMenu = (open) => {
  menu?.classList.toggle("is-open", open);
  toggle?.setAttribute("aria-expanded", String(open));
  toggle?.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
};
toggle?.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
menu?.addEventListener("click", (e) => e.target.closest("a") && setMenu(false));
document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

// Giriş yapmış üyeye "Hesabım" göster (sayfalar önbellekte olduğu için tarayıcıda karar verilir).
if (/(?:^|;\s*)os_in=1/.test(document.cookie)) {
  $$("[data-account-link] span").forEach((el) => (el.textContent = "Hesabım"));
}

/* ---------- Favoriler ----------
   İlan numaraları "os_fav" çerezinde tutulur (en son eklenen önce); /favoriler sayfası çerezi sunucuda okur. */

const FAV_COOKIE = /(?:^|;\s*)os_fav=([^;]*)/;
const readFavs = () =>
  (FAV_COOKIE.exec(document.cookie)?.[1] || "").split(".").filter((id) => /^[a-f0-9]{10}$/.test(id));
function writeFavs(ids) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const maxAge = ids.length ? 365 * 86400 : 0;
  document.cookie = `os_fav=${ids.slice(0, 100).join(".")}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
function syncFavs() {
  const favs = new Set(readFavs());
  $$("[data-fav]").forEach((button) => {
    const on = favs.has(button.dataset.fav);
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Favorilerden çıkar" : "Favorilere ekle");
  });
  $$("[data-fav-count]").forEach((el) => {
    el.textContent = String(favs.size);
    el.hidden = !favs.size;
  });
}
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-fav]");
  if (!button) return;
  e.preventDefault();
  const id = button.dataset.fav;
  const favs = readFavs();
  const on = favs.includes(id);
  writeFavs(on ? favs.filter((x) => x !== id) : [id, ...favs]);
  syncFavs();
  const page = $("[data-favorites-page]");
  if (on && page) {
    button.closest(".card-listing")?.remove();
    if (!$(".card-listing", page)) $("[data-favorites-empty]", page).hidden = false;
  } else if (!on) {
    button.classList.remove("is-pop");
    void button.offsetWidth; // animasyonu yeniden başlat
    button.classList.add("is-pop");
  }
});
syncFavs();
window.addEventListener("pageshow", syncFavs); // geri tuşuyla dönülünce de güncel olsun

/* ---------- Arama formları: il → ilçe ---------- */

const citySelects = $$("[data-city-select]");
if (citySelects.length) {
  import("/assets/js/locations.js").then(({ districtsOf }) => {
    for (const citySelect of citySelects) {
      const district = $("[data-district-select]", citySelect.form);
      if (!district) continue;
      const fill = (selected = "") => {
        const list = districtsOf(citySelect.value);
        district.replaceChildren(
          new Option("Tüm ilçeler", ""),
          ...list.map((d) => new Option(d, d, false, d === selected)),
        );
        district.disabled = !list.length;
      };
      fill(district.dataset.selected);
      citySelect.addEventListener("change", () => fill());
    }
  });
}

$$("[data-autosubmit]").forEach((el) => el.addEventListener("change", () => el.form.submit()));

const filters = $(".filters");
$(".filters-toggle")?.addEventListener("click", (e) => {
  const open = filters.classList.toggle("is-open");
  e.currentTarget.setAttribute("aria-expanded", String(open));
});

/* ---------- Galeri ve büyütme ---------- */

const lightbox = $(".lightbox");
let shots = [];
let current = 0;

function showShot(index) {
  current = (index + shots.length) % shots.length;
  $("img", lightbox).src = shots[current].src;
  $("img", lightbox).alt = shots[current].alt || "";
  $("figcaption", lightbox).textContent = shots.length > 1 ? `${current + 1} / ${shots.length}` : "";
}
function openLightbox(list, index) {
  shots = list;
  lightbox.classList.toggle("is-single", list.length < 2);
  showShot(index);
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  $(".lightbox-close", lightbox).focus();
}
function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}
if (lightbox) {
  $(".lightbox-close", lightbox).addEventListener("click", closeLightbox);
  $(".lightbox-prev", lightbox).addEventListener("click", () => showShot(current - 1));
  $(".lightbox-next", lightbox).addEventListener("click", () => showShot(current + 1));
  lightbox.addEventListener("click", (e) => e.target === lightbox && closeLightbox());
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showShot(current - 1);
    if (e.key === "ArrowRight") showShot(current + 1);
  });
}

const gallery = $("[data-gallery]");
if (gallery) {
  const main = $(".gallery-main", gallery);
  const mainImg = $("img", main);
  const thumbs = $$(".gallery-thumb", gallery);
  const list = thumbs.length
    ? thumbs.map((t) => ({ src: $("img", t).dataset.full, alt: mainImg.alt }))
    : [{ src: mainImg.dataset.full, alt: mainImg.alt }];
  let active = 0;
  thumbs.forEach((thumb, i) =>
    thumb.addEventListener("click", () => {
      active = i;
      mainImg.src = $("img", thumb).dataset.large;
      thumbs.forEach((t) => t.classList.toggle("is-active", t === thumb));
    }),
  );
  main.addEventListener("click", () => openLightbox(list, active));
}

/* ---------- Pencereler ---------- */

$$("[data-open-dialog]").forEach((button) =>
  button.addEventListener("click", () => document.getElementById(button.dataset.openDialog)?.showModal()),
);
$$("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

async function postJson(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw Object.assign(new Error(body.error || "Gönderilemedi, lütfen tekrar deneyin."), { status: res.status, body });
  return body;
}

function setStatus(el, text, type) {
  el.textContent = text;
  el.className = `form-status${type ? ` is-${type}` : ""}`;
}

/* ---------- SMS doğrulama (iletişim bariyeri) ---------- */

const otpDialog = $("#dogrulama");
let otpResolve = null;

// Doğrulama penceresini açar; doğrulama başarılı olunca true ile çözülür.
function requestVerification() {
  if (!otpDialog) return Promise.resolve(false);
  const form = $("[data-otp-form]", otpDialog);
  form.reset();
  $("[data-step=code]", form).hidden = true;
  $("[data-step=phone]", form).hidden = false;
  $("[data-otp-submit]", form).textContent = "Kod gönder";
  setStatus($(".form-status", form), "");
  otpDialog.showModal();
  return new Promise((resolve) => (otpResolve = resolve));
}

if (otpDialog) {
  const form = $("[data-otp-form]", otpDialog);
  const status = $(".form-status", form);
  const submit = $("[data-otp-submit]", form);
  otpDialog.addEventListener("close", () => {
    otpResolve?.(false);
    otpResolve = null;
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const codeStep = !$("[data-step=code]", form).hidden;
    submit.disabled = true;
    try {
      if (!codeStep) {
        const { sentTo } = await postJson("/api/v1/auth/send-otp", { phone: form.phone.value });
        $("[data-step=phone]", form).hidden = true;
        $("[data-step=code]", form).hidden = false;
        submit.textContent = "Doğrula";
        setStatus(status, `${sentTo} numarasına kod gönderdik.`, "success");
        form.code.focus();
      } else {
        await postJson("/api/v1/auth/verify-otp", { phone: form.phone.value, code: form.code.value });
        const resolve = otpResolve;
        otpResolve = null;
        otpDialog.close();
        resolve?.(true);
      }
    } catch (err) {
      setStatus(status, err.message, "error");
    } finally {
      submit.disabled = false;
    }
  });
}

/* ---------- İlan iletişim bilgileri ---------- */

const contactBox = $("[data-contact]");
if (contactBox) {
  const status = $(".form-status", contactBox);
  const cache = {};
  const load = async (type) => {
    if (cache[type]) return cache[type];
    const res = await fetch(`/api/v1/listings/${contactBox.dataset.listing}/contact?type=${type}`, {
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 403 && body.needsVerification) {
      if (!(await requestVerification())) throw new Error("");
      return load(type);
    }
    if (!res.ok) throw new Error(body.error || "İletişim bilgisi alınamadı.");
    return (cache[type] = body);
  };
  const showError = (err) => {
    if (!err.message) return;
    setStatus(status, err.message, "error");
  };

  $("[data-reveal-phone]", contactBox)?.addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      const { phone } = await load("phone");
      const link = document.createElement("a");
      link.className = button.className;
      link.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      link.innerHTML = button.querySelector("svg").outerHTML;
      link.append(phone);
      button.replaceWith(link);
    } catch (err) {
      button.disabled = false;
      showError(err);
    }
  });

  $("[data-open-whatsapp]", contactBox)?.addEventListener("click", async () => {
    const open = (whatsapp) => {
      const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(contactBox.dataset.waText)}`;
      if (!window.open(url, "_blank")) location.href = url;
    };
    if (cache.whatsapp) return open(cache.whatsapp.whatsapp);
    try {
      open((await load("whatsapp")).whatsapp);
    } catch (err) {
      showError(err);
    }
  });
}

// Formlarda adı hatırlamak için (tarayıcı izin vermezse sessizce geçilir)
function remember(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key) || "";
    localStorage.setItem(key, value);
  } catch {
    return "";
  }
}

const authStatus = () =>
  fetch("/api/v1/auth/status", { credentials: "same-origin" })
    .then((r) => r.json())
    .catch(() => ({}));

/* ---------- İlan görüntülenme sayacı (aynı ilan bu tarayıcıdan günde bir kez sayılır) ---------- */

if (contactBox) {
  const key = `os_view_${contactBox.dataset.listing}`;
  const today = new Date().toISOString().slice(0, 10);
  if (remember(key) !== today) {
    remember(key, today);
    fetch("/api/v1/analytics/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: contactBox.dataset.listing }),
      keepalive: true,
    }).catch(() => {});
  }
}

/* ---------- Teklif talebi ---------- */

const requestForm = $("[data-request-form]");
const requestButton = $("[data-open-request]");
if (requestForm && requestButton) {
  const dialog = requestForm.closest("dialog");
  const status = $(".form-status", requestForm);
  const phoneField = $("[data-request-phone]", requestForm);
  const submit = $("button[type=submit]", requestForm);
  // Doğrulanmış numarası olan ziyaretçiden telefon istenmez; bariyer açıksa önce SMS doğrulaması yapılır.
  const open = async () => {
    requestButton.disabled = true;
    try {
      const auth = await authStatus();
      let verified = Boolean(auth.verified);
      if (!verified && auth.gate) verified = await requestVerification();
      if (!verified && auth.gate) return;
      phoneField.hidden = verified;
      requestForm.phone.required = !verified;
      const today = new Date();
      requestForm.eventDate.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      if (!requestForm.name.value) requestForm.name.value = remember("os_name");
      setStatus(status, "");
      dialog.showModal();
    } finally {
      requestButton.disabled = false;
    }
  };
  requestButton.addEventListener("click", open);
  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (requestForm.name.value.trim().length < 2) return setStatus(status, "Lütfen adınızı yazın.", "error");
    if (requestForm.message.value.trim().length < 10)
      return setStatus(status, "Lütfen ayrıntıları biraz daha açık yazın (en az 10 karakter).", "error");
    submit.disabled = true;
    try {
      const result = await postJson(
        `/api/v1/listings/${requestForm.dataset.listing}/request`,
        Object.fromEntries(new FormData(requestForm)),
      );
      remember("os_name", requestForm.name.value.trim());
      requestForm.reset();
      dialog.close();
      requestButton.disabled = true;
      requestButton.lastChild.textContent = "Talebiniz iletildi";
      const note = $(".form-status", contactBox || requestButton.parentElement);
      setStatus(note, `${result.company} talebinizi aldı; sizi ${result.phone} numarasından arayacak.`, "success");
    } catch (err) {
      if (err.body?.needsVerification) {
        dialog.close();
        if (await requestVerification()) open();
        return;
      }
      setStatus(status, err.message, "error");
    } finally {
      submit.disabled = false;
    }
  });
}

/* ---------- Firma değerlendirmesi ---------- */

const reviewForm = $("[data-review-form]");
const reviewButton = $("[data-open-review]");
if (reviewForm && reviewButton) {
  const dialog = reviewForm.closest("dialog");
  const status = $(".form-status", reviewForm);
  const submit = $("button[type=submit]", reviewForm);
  // Yorum yazmak için telefon doğrulaması gerekir (sahte yorumları engellemek için).
  const open = async () => {
    reviewButton.disabled = true;
    try {
      const auth = await authStatus();
      if (!auth.verified && !(await requestVerification())) return;
      if (!reviewForm.name.value) reviewForm.name.value = remember("os_name");
      setStatus(status, "");
      dialog.showModal();
    } finally {
      reviewButton.disabled = false;
    }
  };
  reviewButton.addEventListener("click", open);
  if (location.hash === "#degerlendir") open();
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!reviewForm.rating.value) return setStatus(status, "Lütfen 1 ile 5 arasında yıldız seçin.", "error");
    if (reviewForm.name.value.trim().length < 2) return setStatus(status, "Lütfen adınızı yazın.", "error");
    if (reviewForm.comment.value.trim().length < 20)
      return setStatus(status, "Lütfen deneyiminizi biraz daha ayrıntılı anlatın (en az 20 karakter).", "error");
    submit.disabled = true;
    try {
      await postJson(`/api/v1/firms/${reviewForm.dataset.firm}/reviews`, Object.fromEntries(new FormData(reviewForm)));
      remember("os_name", reviewForm.name.value.trim());
      reviewForm.reset();
      dialog.close();
      reviewButton.disabled = true;
      setStatus(
        $("[data-review-status]"),
        "Teşekkürler! Değerlendirmeniz incelendikten sonra yayınlanacak.",
        "success",
      );
    } catch (err) {
      if (err.body?.needsVerification) {
        dialog.close();
        if (await requestVerification()) open();
        return;
      }
      setStatus(status, err.message, "error");
    } finally {
      submit.disabled = false;
    }
  });
}

/* ---------- Şikâyet ---------- */

const reportForm = $("[data-report-form]");
reportForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $(".form-status", reportForm);
  const submit = $("button[type=submit]", reportForm);
  submit.disabled = true;
  try {
    await postJson(
      `/api/v1/listings/${reportForm.dataset.listing}/report`,
      Object.fromEntries(new FormData(reportForm)),
    );
    setStatus(status, "Teşekkürler, bildiriminiz bize ulaştı.", "success");
    setTimeout(() => reportForm.closest("dialog").close(), 1800);
  } catch (err) {
    setStatus(status, err.message, "error");
  } finally {
    submit.disabled = false;
  }
});

/* ---------- Vitrin kaydırıcısı ---------- */

$$("[data-slider]").forEach((track) => {
  const section = track.closest("section");
  const step = () => (track.firstElementChild?.getBoundingClientRect().width || 300) + 20;
  $(".slider-prev", section)?.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  $(".slider-next", section)?.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
});

/* ---------- Müsaitlik takvimi ---------- */

const busyBox = $("[data-busy-calendar]");
if (busyBox) {
  fetch(`/api/v1/organizer/calendar?listing=${busyBox.dataset.listing}`)
    .then((r) => (r.ok ? r.json() : { busy: [] }))
    .then(({ busy }) => {
      const set = new Set(busy);
      const today = new Date();
      const months = [0, 1, 2].map((offset) => new Date(today.getFullYear(), today.getMonth() + offset, 1));
      const iso = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const html = months
        .map((first) => {
          const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
          const lead = (first.getDay() + 6) % 7; // Pazartesi başlangıç
          const cells = [];
          for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell is-empty"></span>');
          for (let d = 1; d <= days; d++) {
            const date = new Date(first.getFullYear(), first.getMonth(), d);
            const key = iso(date);
            const past = key < iso(today);
            cells.push(
              `<span class="cal-cell${set.has(key) ? " is-busy" : ""}${past ? " is-past" : ""}" title="${set.has(key) ? "Dolu" : ""}">${d}</span>`,
            );
          }
          const title = first.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
          return `<div class="cal-month"><h3>${title}</h3><div class="cal-grid">${[
            "Pt",
            "Sa",
            "Ça",
            "Pe",
            "Cu",
            "Ct",
            "Pz",
          ]
            .map((w) => `<span class="cal-head">${w}</span>`)
            .join("")}${cells.join("")}</div></div>`;
        })
        .join("");
      $(".busy-months", busyBox).innerHTML = html;
    })
    .catch(() => busyBox.remove());
}

// Bütçe alanları: yalnızca rakam
$$(".sf-range input").forEach((input) =>
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "").slice(0, 8);
    input.value = digits;
  }),
);

/* ---------- İletişim formu ---------- */

const contactForm = $("#iletisim-formu");
contactForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = contactForm.elements;
  const status = $(".form-status", contactForm);
  $$(".field", contactForm).forEach((el) => el.classList.remove("is-invalid"));
  const invalid = [];
  if (f.name.value.trim().length < 2) invalid.push(f.name);
  if (f.phone.value.replace(/\D/g, "").length < 10) invalid.push(f.phone);
  if (f.message.value.trim().length < 5) invalid.push(f.message);
  if (invalid.length) {
    invalid.forEach((el) => el.closest(".field").classList.add("is-invalid"));
    invalid[0].focus();
    return setStatus(status, "Lütfen ad soyad, telefon ve mesaj alanlarını doldurun.", "error");
  }
  const submit = $("button[type=submit]", contactForm);
  submit.disabled = true;
  setStatus(status, "Gönderiliyor…");
  try {
    await postJson("/api/messages", Object.fromEntries(new FormData(contactForm)));
    contactForm.reset();
    setStatus(status, "Teşekkürler! Mesajınız bize ulaştı, en kısa sürede dönüş yapacağız.", "success");
  } catch (err) {
    setStatus(status, err.message, "error");
  } finally {
    submit.disabled = false;
  }
});
