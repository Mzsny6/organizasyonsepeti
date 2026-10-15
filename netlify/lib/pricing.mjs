// İlan paketleri ve dopingler (PRD: kademeli ilan + doping).
export const PACKAGES = {
  monthly: { label: "1 Aylık", days: 30 },
  quarterly: { label: "3 Aylık", days: 90 },
  yearly: { label: "Yıllık (2 ay bedava)", days: 365 },
};

export const DOPINGS = {
  showcase: { label: "Ana Sayfa Vitrini", where: "Ana sayfadaki vitrin alanında gösterilir", unit: "hafta" },
  categoryTop: {
    label: "Kategori Üst Sıra",
    where: "Kendi kategorisinin arama sonuçlarında en üstte çıkar",
    unit: "hafta",
  },
  highlight: { label: "Renkli Çerçeve & Rozet", where: "İlan kartı renkli çerçeve ve rozetle öne çıkar", unit: "ay" },
};

export const tierOf = (content, categoryId) => content.categories.find((c) => c.id === categoryId)?.tier || 3;

export function packagePrice(content, categoryId, pkg) {
  if (content.pricing.freeMode) return 0;
  return content.pricing.tiers[`t${tierOf(content, categoryId)}`]?.[pkg] ?? 0;
}

export function dopingPrice(content, key) {
  return content.pricing.freeMode ? 0 : (content.pricing.dopings[key]?.price ?? 0);
}

export const applyDiscount = (price, percent) => Math.max(0, Math.round((price * (100 - (percent || 0))) / 100));

// Herkese açık fiyat tablosu (hesap ekranı ve /api/v1 için).
export function priceTable(content) {
  return {
    freeMode: content.pricing.freeMode,
    packages: Object.fromEntries(Object.entries(PACKAGES).map(([k, p]) => [k, p])),
    tiers: content.pricing.tiers,
    dopings: Object.fromEntries(
      Object.entries(DOPINGS).map(([k, d]) => [
        k,
        { ...d, price: dopingPrice(content, k), days: content.pricing.dopings[k].days },
      ]),
    ),
    bank: content.pricing.bank,
  };
}
