const FOLD = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

// Türkçe karakterlerden bağımsız arama ve adres üretimi için: "Doğum Günü" -> "dogum gunu"
export const foldText = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (c) => FOLD[c]);

export const slugify = (s, fallback = "ilan") =>
  foldText(s)
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "") || fallback;
