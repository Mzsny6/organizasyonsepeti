// Ziyaretçiye açık ilan işlemleri: iletişim bilgisini gösterme ve şikâyet.
import { fail, handleError, json, readJson } from "../lib/http.mjs";
import { HOUR, countHit, isLimited } from "../lib/limits.mjs";
import { createReport, getListing } from "../lib/listings.mjs";

// Telefon numaraları sayfaya yazılmaz, butona basınca buradan alınır (toplu numara toplanmasını zorlaştırır).
async function contact(listing, context) {
  if (await isLimited("contact", context.ip, 120, HOUR)) {
    return fail(429, "Çok fazla istek yapıldı. Lütfen biraz sonra tekrar deneyin.");
  }
  await countHit("contact", context.ip, HOUR);
  let wa = "";
  if (listing.whatsapp) {
    wa = listing.phone.replace(/\D/g, "");
    if (/^0\d{10}$/.test(wa)) wa = `9${wa}`;
  }
  return json({ phone: listing.phone, whatsapp: wa, instagram: listing.instagram });
}

async function report(req, listing, context) {
  if (await isLimited("report", context.ip, 5, HOUR)) {
    return fail(429, "Kısa sürede çok fazla bildirim gönderildi. Lütfen daha sonra tekrar deneyin.");
  }
  const body = await readJson(req, 4096);
  if (body.website) return json({ ok: true }, 201);
  await createReport(listing, body);
  await countHit("report", context.ip, HOUR);
  return json({ ok: true }, 201);
}

export default async (req, context) => {
  try {
    const listing = await getListing(context.params?.id);
    if (!listing || listing.status !== "active") return fail(404, "İlan bulunamadı ya da yayında değil.");
    const action = context.params?.action;
    if (action === "contact" && req.method === "GET") return await contact(listing, context);
    if (action === "report" && req.method === "POST") return await report(req, listing, context);
    return fail(404, "Bulunamadı.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: "/api/listings/:id/:action" };
