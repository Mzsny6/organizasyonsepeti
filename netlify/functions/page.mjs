import { getContent, normalizeContent } from "../lib/content.mjs";
import { SECURITY_HEADERS } from "../lib/http.mjs";
import { renderPage } from "../lib/render.mjs";

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

export default async () => {
  let content;
  let cacheable = true;
  try {
    content = await getContent();
  } catch (err) {
    console.error("İçerik okunamadı, varsayılan içerik gösteriliyor:", err);
    content = normalizeContent({});
    cacheable = false;
  }

  return new Response(renderPage(content), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      // CDN'de saklanır; panelden kaydedince önbellek temizlenir (bkz. lib/cache.mjs).
      "Netlify-CDN-Cache-Control": cacheable
        ? "public, durable, s-maxage=300, stale-while-revalidate=604800"
        : "no-store",
      "Content-Security-Policy": CSP,
      ...SECURITY_HEADERS,
    },
  });
};

export const config = { path: "/", method: ["GET", "HEAD"] };
