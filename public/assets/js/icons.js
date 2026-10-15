// Sitede ve yönetim panelinde ortak kullanılan çizgi ikonlar (24x24).
export const ICONS = {
  balloon: {
    label: "Balon",
    d: '<path d="M12 2.5c3.4 0 6 2.7 6 6.3 0 3.9-3 7.2-6 7.2s-6-3.3-6-7.2c0-3.6 2.6-6.3 6-6.3Z"/><path d="M11 16.2 10.4 18h3.2l-.6-1.8"/><path d="M12 18c0 1.6-1.6 2-1.6 3.5"/>',
  },
  cake: {
    label: "Pasta",
    d: '<path d="M4 21h16"/><path d="M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 16c1.2 0 1.8-1 3.5-1s2.3 1 3.5 1 1.8-1 3.5-1 2.3 1 3.5 1"/><path d="M12 12V8"/><path d="M12 5.6c.9-.8.9-1.8 0-2.6-.9.8-.9 1.8 0 2.6Z"/>',
  },
  ring: { label: "Yüzük", d: '<circle cx="12" cy="15" r="6"/><path d="m9 6 1.5-3h3L15 6l-3 3.2L9 6Z"/>' },
  heart: {
    label: "Kalp",
    d: '<path d="M12 20s-7.5-4.5-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.5 12 20 12 20Z"/>',
  },
  moon: {
    label: "Hilal / Kına",
    d: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z"/><path d="m17 3 .6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6L17 3Z"/>',
  },
  baby: {
    label: "Bebek",
    d: '<path d="M9 3h6l4.5 4-2.6 2.6L15 8.2V20H9V8.2L7.1 9.6 4.5 7 9 3Z"/><path d="M9 3a3 3 0 0 0 6 0"/><path d="M9 16h6"/>',
  },
  gift: {
    label: "Hediye",
    d: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8"/><path d="M12 8v12"/><path d="M12 8c-1.6-3-5-3.6-5-1.6S10.2 8 12 8Zm0 0c1.6-3 5-3.6 5-1.6S13.8 8 12 8Z"/>',
  },
  store: {
    label: "Mağaza / Açılış",
    d: '<path d="M4 10v10h16V10"/><path d="m3 10 2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
  },
  crown: { label: "Taç", d: '<path d="M4 19h16"/><path d="M4.5 16 3 7l5 4 4-6 4 6 5-4-1.5 9h-15Z"/>' },
  sparkles: {
    label: "Işıltı",
    d: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15Z"/>',
  },
  star: {
    label: "Yıldız",
    d: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  },
  flower: {
    label: "Çiçek",
    d: '<circle cx="12" cy="12" r="2.4"/><path d="M12 9.6C10 6 10.5 3 12 3s2 3 0 6.6Zm0 4.8c2 3.6 1.5 6.6 0 6.6s-2-3 0-6.6ZM9.6 12C6 14 3 13.5 3 12s3-2 6.6 0Zm4.8 0c3.6-2 6.6-1.5 6.6 0s-3 2-6.6 0Z"/>',
  },
  party: {
    label: "Parti",
    d: '<path d="M4 20 9 6l9 9-14 5Z"/><path d="M14 3.5c1 1 1 2.2 0 3.2M18 8c1-1 2.2-1 3.2 0M17 2.5v1.2M21.5 6.5h-1.2M19.5 3.5l-.8.8"/>',
  },
  camera: { label: "Fotoğraf", d: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/>' },
  music: {
    label: "Müzik",
    d: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  },
  // Arayüz ikonları
  phone: {
    ui: true,
    d: '<path d="M6.5 3h3l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5a2 2 0 0 1 2-2Z"/>',
  },
  mail: { ui: true, d: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>' },
  pin: {
    ui: true,
    d: '<path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.4"/>',
  },
  clock: { ui: true, d: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  check: { ui: true, d: '<path d="m5 12.5 4.2 4.2L19 7"/>' },
  arrow: { ui: true, d: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>' },
  instagram: {
    ui: true,
    d: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
  },
  facebook: {
    ui: true,
    d: '<path d="M14 8.5V7c0-.8.5-1.2 1.2-1.2H17V2.5h-2.6C11.8 2.5 10.5 4 10.5 6.6v1.9H8V12h2.5v9.5H14V12h2.6l.5-3.5H14Z"/>',
  },
  tiktok: { ui: true, d: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/>' },
  whatsapp: {
    ui: true,
    d: '<path d="M4 20.5 5.3 16.6A8.5 8.5 0 1 1 8.6 19.5L4 20.5Z"/><path d="M9.3 8.3c.2-.4.5-.4.8-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.6l-.5.6c-.1.2-.2.4 0 .6.5.9 1.5 1.9 2.6 2.4.2.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5 0 .5-.2 1.1-.6 1.4-.5.4-1.3.6-2.2.3-1.9-.6-3.6-2.1-4.6-3.7-.6-1-.9-2-.8-2.9.1-.5.2-.9.6-1.3Z"/>',
  },
  menu: { ui: true, d: '<path d="M4 7h16M4 12h16M4 17h16"/>' },
  close: { ui: true, d: '<path d="M6 6l12 12M18 6 6 18"/>' },
  chevron: { ui: true, d: '<path d="m9 6 6 6-6 6"/>' },
  quote: {
    ui: true,
    d: '<path d="M10 7c-3 1-5 3.5-5 7v3h5v-5H7.5c0-2 1-3.5 2.5-4V7Zm9 0c-3 1-5 3.5-5 7v3h5v-5h-2.5c0-2 1-3.5 2.5-4V7Z"/>',
  },
};

export function icon(name, cls = "icon") {
  const item = ICONS[name] || ICONS.balloon;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${item.d}</svg>`;
}
