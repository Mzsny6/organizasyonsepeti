// Organizatörün ajandasını telefon takvimine (Google Takvim, iPhone Takvim, Outlook) aktaran abonelik dosyası.
// Bağlantı gizli bir anahtar içerir; organizatör panelden yenileyip eskisini geçersiz kılabilir.
import { bookingsToIcs, listBookings, userByIcsToken } from "../lib/bookings.mjs";
import { getContent } from "../lib/content.mjs";
import { readIndex } from "../lib/listings.mjs";

export default async (req, context) => {
  const token = /^([a-f0-9]{36})\.ics$/.exec(context.params?.file || "")?.[1];
  const user = token ? await userByIcsToken(token) : null;
  if (!user)
    return new Response("Takvim bulunamadı.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  const [bookings, index, content] = await Promise.all([listBookings(user.id), readIndex(), getContent()]);
  const listings = index.filter((x) => x.userId === user.id);
  return new Response(bookingsToIcs(user, bookings, { listings, siteName: content.settings.siteName }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="ajanda.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
};

export const config = { path: "/takvim/:file", method: ["GET", "HEAD"] };
