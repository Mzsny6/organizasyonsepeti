const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Kaydırınca başlık arka planı
const header = $(".site-header");
const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 12);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Mobil menü
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

// Galeri filtresi
const filters = $(".gallery-filters");
filters?.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-filter]");
  if (!chip) return;
  $$(".chip", filters).forEach((c) => c.classList.toggle("is-active", c === chip));
  const value = chip.dataset.filter;
  $$(".gallery-item").forEach((item) => (item.hidden = Boolean(value) && item.dataset.category !== value));
});

// Galeri büyütme
const lightbox = $(".lightbox");
let current = -1;
const visibleItems = () => $$(".gallery-item:not([hidden])");
function showImage(index) {
  const items = visibleItems();
  if (!items.length) return;
  current = (index + items.length) % items.length;
  const img = $("img", items[current]);
  $("img", lightbox).src = img.currentSrc || img.src;
  $("img", lightbox).alt = img.alt;
  $("figcaption", lightbox).textContent = $("figcaption", items[current])?.textContent || "";
}
function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}
$(".gallery-grid")?.addEventListener("click", (e) => {
  const item = e.target.closest(".gallery-item");
  if (!item) return;
  showImage(visibleItems().indexOf(item));
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  $(".lightbox-close", lightbox).focus();
});
if (lightbox) {
  $(".lightbox-close", lightbox).addEventListener("click", closeLightbox);
  $(".lightbox-prev", lightbox).addEventListener("click", () => showImage(current - 1));
  $(".lightbox-next", lightbox).addEventListener("click", () => showImage(current + 1));
  lightbox.addEventListener("click", (e) => e.target === lightbox && closeLightbox());
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showImage(current - 1);
    if (e.key === "ArrowRight") showImage(current + 1);
  });
}

// Teklif formu
const form = $("#teklif-formu");
if (form) {
  const status = $(".form-status", form);
  const submit = $("button[type=submit]", form);
  const waButton = $("[data-wa]", form);

  // "Teklif iste" / "Bu paketi seç" bağlantıları formu ön doldurur.
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-event], [data-package]");
    if (!link) return;
    if (link.dataset.event) form.eventType.value = link.dataset.event;
    if (link.dataset.package && !form.message.value.trim()) {
      form.message.value = `${link.dataset.package} hakkında bilgi almak istiyorum.`;
    }
  });

  const summary = () => {
    const f = form.elements;
    const lines = [`Merhaba, ${f.eventType.value ? `${f.eventType.value} için ` : ""}teklif almak istiyorum.`];
    if (f.name.value.trim()) lines.push(`Ad: ${f.name.value.trim()}`);
    if (f.date.value) lines.push(`Tarih: ${new Date(f.date.value).toLocaleDateString("tr-TR")}`);
    if (f.guests.value.trim()) lines.push(`Kişi sayısı: ${f.guests.value.trim()}`);
    if (f.message.value.trim()) lines.push(f.message.value.trim());
    return lines.join("\n");
  };

  waButton?.addEventListener("click", () => {
    waButton.href = `https://wa.me/${waButton.dataset.wa}?text=${encodeURIComponent(summary())}`;
  });

  const setStatus = (text, type) => {
    status.textContent = text;
    status.className = `form-status${type ? ` is-${type}` : ""}`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = form.elements;
    $$(".field", form).forEach((el) => el.classList.remove("is-invalid"));
    const invalid = [];
    if (f.name.value.trim().length < 2) invalid.push(f.name);
    if (f.phone.value.replace(/\D/g, "").length < 10) invalid.push(f.phone);
    if (invalid.length) {
      invalid.forEach((el) => el.closest(".field").classList.add("is-invalid"));
      invalid[0].focus();
      setStatus("Lütfen ad soyad ve telefon numaranızı kontrol edin.", "error");
      return;
    }

    submit.disabled = true;
    setStatus("Gönderiliyor…");
    try {
      const data = Object.fromEntries(new FormData(form));
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Mesaj gönderilemedi.");
      form.reset();
      setStatus("Teşekkürler! Talebiniz bize ulaştı, en kısa sürede size dönüş yapacağız.", "success");
    } catch (err) {
      setStatus(`${err.message} ${waButton ? "Dilerseniz WhatsApp'tan da yazabilirsiniz." : ""}`, "error");
    } finally {
      submit.disabled = false;
    }
  });
}
