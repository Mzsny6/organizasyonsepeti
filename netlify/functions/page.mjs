// Sitenin herkese açık sayfalarını sunucuda oluşturur.
import { getContent, normalizeContent } from "../lib/content.mjs";
import { SECURITY_HEADERS } from "../lib/http.mjs";
import { getListing, listingPath, parseListingParam, readIndex } from "../lib/listings.mjs";
import { renderHome } from "../lib/render/home.mjs";
import { renderListing } from "../lib/render/listing.mjs";
import { renderContact, renderLegal, renderNotFound } from "../lib/render/pages.mjs";
import { renderSearch } from "../lib/render/search.mjs";
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
      "Cache-Control": "public, max-age=0, must-revalidate",
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
    if (path === "/ilanlar") return html(renderSearch(content, await readIndex(), url.searchParams));
    if (path.startsWith("/ilan/")) return await listingPage(content, context.params?.slug);
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
  path: ["/", "/ilanlar", "/ilan/:slug", "/kvkk", "/kullanim-kosullari", "/iletisim"],
  method: ["GET", "HEAD"],
};
