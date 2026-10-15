import { getContent } from "../lib/content.mjs";
import { firmPath, liveListings, listingPath, readIndex } from "../lib/listings.mjs";
import { searchPath } from "../lib/render/urls.mjs";

const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export default async () => {
  const [{ settings, categories, events }, index] = await Promise.all([getContent(), readIndex()]);
  const base = settings.siteUrl.replace(/\/$/, "");
  const live = liveListings(index);
  const firms = [...new Map(live.map((x) => [x.userId, x])).values()];
  // Yalnızca en az bir yayında ilanı olan arama sayfaları (boş sayfalar dizinlenmez)
  const landings = new Set();
  for (const x of live) {
    const cat = categories.find((c) => c.id === x.category);
    if (cat) landings.add(searchPath({ kategori: cat.slug })).add(searchPath({ kategori: cat.slug, il: x.city }));
    landings.add(searchPath({ il: x.city }));
    for (const id of x.events) {
      const event = events.find((e) => e.id === id);
      if (event) landings.add(searchPath({ etkinlik: event.slug }));
    }
  }
  const urls = [
    { loc: `${base}/`, priority: "1.0" },
    { loc: `${base}/ilanlar`, priority: "0.9" },
    ...[...landings].map((path) => ({ loc: `${base}${path}`, priority: path.split("/").length > 3 ? "0.7" : "0.8" })),
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
