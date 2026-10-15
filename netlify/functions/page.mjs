// Sitenin herkese açık sayfalarını sunucuda oluşturur.
import { getContent, normalizeContent } from "../lib/content.mjs";
import { readCookie } from "../lib/crypto.mjs";
import { SECURITY_HEADERS } from "../lib/http.mjs";
import {
  LISTING_ID,
  firmPath,
  getListing,
  listingPath,
  parseFirmParam,
  parseListingParam,
  readIndex,
} from "../lib/listings.mjs";
import { renderFavorites, renderFirm } from "../lib/render/firm.mjs";
import { renderHome } from "../lib/render/home.mjs";
import { renderListing } from "../lib/render/listing.mjs";
import { renderContact, renderLegal, renderNotFound } from "../lib/render/pages.mjs";
import { parseSearch, renderSearch } from "../lib/render/search.mjs";
import { cityFromSlug, isLandingPath, searchPath } from "../lib/render/urls.mjs";
import { getUser } from "../lib/users.mjs";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const html = (body, { status = 200, cacheable = true } = {}) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheable ? "public, max-age=0, must-revalidate" : "private, no-store",
      // CDN'de saklanır; içerik ya da ilan değişince önbellek temizlenir (bkz. lib/cache.mjs).
      "Netlify-CDN-Cache-Control": cacheable
        ? "public, durable, s-maxage=300, stale-while-revalidate=604800"
        : "no-store",
      "Content-Security-Policy": CSP,
      ...SECURITY_HEADERS,
    },
  });

async function listingPage(c, param) {
  const listing = await getListing(parseListingParam(param));
  if (!listing || listing.status !== "active") {
    return html(renderNotFound(c, "Bu ilan yayından kaldırılmış ya da hiç var olmamış olabilir."), { status: 404 });
  }
  // Başlık değişince adres de değişir; eski adresler yenisine yönlendirilir.
  if (param !== `${listing.slug}-${listing.id}`) {
    return new Response(null, { status: 301, headers: { Location: listingPath(listing) } });
  }
  const [owner, index] = await Promise.all([getUser(listing.userId), readIndex()]);
  return html(renderListing(c, listing, owner, index));
}

// /ilanlar ve temiz adresli arama sayfaları (/hizmet/:kategori[/:il], /il/:il, /etkinlik/:etkinlik).
// Aynı arama tek adreste dizinlensin diye eşdeğer adresler temiz adrese kalıcı yönlendirilir.
async function searchPage(c, url, path) {
  const params = new URLSearchParams(url.searchParams);
  const [kind, first, second] = path.split("/").filter(Boolean);
  if (kind !== "ilanlar") {
    const notFound = () => html(renderNotFound(c, "Aradığınız sayfa bulunamadı."), { status: 404 });
    if (kind === "hizmet") {
      if (!c.categories.some((cat) => cat.slug === first)) return notFound();
      params.set("kategori", first);
      if (second) {
        if (!cityFromSlug(second)) return notFound();
        params.set("il", cityFromSlug(second));
      }
    }
    if (kind === "il") {
      if (!cityFromSlug(first)) return notFound();
      params.set("il", cityFromSlug(first));
    }
    if (kind === "etkinlik") {
      if (!c.events.some((e) => e.slug === first)) return notFound();
      params.set("etkinlik", first);
    }
  }
  const target = searchPath(parseSearch(c, params));
  if (isLandingPath(target) && target !== `${path}${url.search}`) {
    return new Response(null, { status: 301, headers: { Location: target } });
  }
  return html(renderSearch(c, await readIndex(), params));
}

async function firmPage(c, param) {
  const owner = await getUser(parseFirmParam(param));
  if (!owner || (owner.role || "organizer") !== "organizer" || owner.status === "banned") {
    return html(renderNotFound(c, "Bu firma sayfası bulunamadı."), { status: 404 });
  }
  const path = firmPath({ company: owner.company, userId: owner.id });
  if (`/firma/${param}` !== path) return new Response(null, { status: 301, headers: { Location: path } });
  return html(renderFirm(c, owner, await readIndex()));
}

// Favoriler tarayıcıdaki "os_fav" çerezinde tutulur (ör. "a1b2c3d4e5.f6a7b8c9d0"); sayfa kişiye özeldir, önbelleğe alınmaz.
function favoriteIds(req) {
  return [...new Set((readCookie(req, "os_fav") || "").split("."))].filter((id) => LISTING_ID.test(id)).slice(0, 100);
}

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  let content;
  try {
    content = await getContent();
  } catch (err) {
    console.error("İçerik okunamadı, varsayılan içerik gösteriliyor:", err);
    return html(renderHome(normalizeContent({}), []), { cacheable: false });
  }

  try {
    if (path === "/") return html(renderHome(content, await readIndex()));
    if (path === "/ilanlar" || /^\/(hizmet|il|etkinlik)\//.test(path)) return await searchPage(content, url, path);
    if (path.startsWith("/ilan/")) return await listingPage(content, context.params?.slug);
    if (path.startsWith("/firma/")) return await firmPage(content, context.params?.slug);
    if (path === "/favoriler") {
      return html(renderFavorites(content, await readIndex(), favoriteIds(req)), { cacheable: false });
    }
    if (path === "/kvkk") return html(renderLegal(content, "kvkk"));
    if (path === "/kullanim-kosullari") return html(renderLegal(content, "terms"));
    if (path === "/iletisim") return html(renderContact(content));
    return html(renderNotFound(content), { status: 404 });
  } catch (err) {
    console.error(err);
    return html(renderNotFound(content, "Beklenmeyen bir hata oluştu. Lütfen biraz sonra tekrar deneyin."), {
      status: 500,
      cacheable: false,
    });
  }
};

export const config = {
  path: [
    "/",
    "/ilanlar",
    "/hizmet/:kategori",
    "/hizmet/:kategori/:il",
    "/il/:il",
    "/etkinlik/:etkinlik",
    "/ilan/:slug",
    "/firma/:slug",
    "/favoriler",
    "/kvkk",
    "/kullanim-kosullari",
    "/iletisim",
  ],
  method: ["GET", "HEAD"],
};
