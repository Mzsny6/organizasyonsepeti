const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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

/* ---------- İlan iletişim bilgileri ---------- */

const contactBox = $("[data-contact]");
if (contactBox) {
  const status = $(".form-status", contactBox);
  let contact;
  const load = async () => {
    if (contact) return contact;
    const res = await fetch(`/api/listings/${contactBox.dataset.listing}/contact`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "İletişim bilgisi alınamadı.");
    return (contact = body);
  };
  const showError = (err) => {
    status.textContent = err.message;
    status.className = "form-status is-error";
  };

  $("[data-reveal-phone]", contactBox)?.addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      const { phone } = await load();
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
    // Pencere tıklama anında açılır; adres bilgi gelince verilir (açılır pencere engelleyicileri için).
    const win = window.open("", "_blank");
    try {
      const { whatsapp } = await load();
      const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(contactBox.dataset.waText)}`;
      if (win) win.location.href = url;
      else location.href = url;
    } catch (err) {
      win?.close();
      showError(err);
    }
  });
}

/* ---------- Pencereler (şikâyet) ---------- */

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
  if (!res.ok) throw new Error(body.error || "Gönderilemedi, lütfen tekrar deneyin.");
  return body;
}

function setStatus(el, text, type) {
  el.textContent = text;
  el.className = `form-status${type ? ` is-${type}` : ""}`;
}

const reportForm = $("[data-report-form]");
reportForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $(".form-status", reportForm);
  const submit = $("button[type=submit]", reportForm);
  submit.disabled = true;
  try {
    await postJson(`/api/listings/${reportForm.dataset.listing}/report`, Object.fromEntries(new FormData(reportForm)));
    setStatus(status, "Teşekkürler, bildiriminiz bize ulaştı.", "success");
    setTimeout(() => reportForm.closest("dialog").close(), 1800);
  } catch (err) {
    setStatus(status, err.message, "error");
  } finally {
    submit.disabled = false;
  }
});

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
