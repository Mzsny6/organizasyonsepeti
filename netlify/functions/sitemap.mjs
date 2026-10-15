import { getContent } from "../lib/content.mjs";
import { firmPath, liveListings, listingPath, readIndex } from "../lib/listings.mjs";

const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export default async () => {
  const [{ settings, categories }, index] = await Promise.all([getContent(), readIndex()]);
  const base = settings.siteUrl.replace(/\/$/, "");
  const live = liveListings(index);
  const firms = [...new Map(live.map((x) => [x.userId, x])).values()];
  const urls = [
    { loc: `${base}/`, priority: "1.0" },
    { loc: `${base}/ilanlar`, priority: "0.9" },
    ...categories.map((c) => ({ loc: `${base}/ilanlar?kategori=${c.slug}`, priority: "0.8" })),
    ...live.map((x) => ({ loc: `${base}${listingPath(x)}`, lastmod: x.updatedAt.slice(0, 10), priority: "0.7" })),
    ...firms.map((x) => ({ loc: `${base}${firmPath(x)}`, priority: "0.6" })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`,
    )
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
};

export const config = { path: "/sitemap.xml", method: ["GET", "HEAD"] };
