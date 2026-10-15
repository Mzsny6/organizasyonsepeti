// Yönetim paneli: ilan moderasyonu, üyeler ve şikâyetler.
import { randomInt } from "node:crypto";
import { requireAdmin } from "../lib/auth.mjs";
import { purgeSite } from "../lib/cache.mjs";
import { messageStore } from "../lib/content.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";
import {
  deleteListing,
  deleteReport,
  deleteUserListings,
  getListing,
  hideUserListings,
  listReports,
  moderateListing,
  readIndex,
  setFeatured,
  updateReport,
} from "../lib/listings.mjs";
import { deleteUserRecord, getUser, listUsers, publicUser, saveUser, setUserPassword } from "../lib/users.mjs";

const REPORT_ID = /^\d{13}-[a-f0-9]{10}$/;

// Karışması zor harfler/rakamlarla geçici şifre (0/O, 1/l yok).
function temporaryPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join("");
}

async function summary() {
  const [index, users, reports, messages] = await Promise.all([
    readIndex(),
    listUsers(),
    listReports(),
    messageStore().list(),
  ]);
  const unread = await Promise.all(messages.blobs.slice(-200).map((b) => messageStore().get(b.key, { type: "json" })));
  return json({
    listings: {
      pending: index.filter((x) => x.status === "pending").length,
      active: index.filter((x) => x.status === "active").length,
      total: index.length,
    },
    users: users.length,
    reports: reports.filter((r) => r.status === "open").length,
    unreadMessages: unread.filter((m) => m && !m.read).length,
  });
}

async function listingsRoute(req, id, action) {
  if (!id && req.method === "GET") {
    return json({ listings: (await readIndex()).map(({ text, ...rest }) => rest) });
  }
  const listing = await getListing(id);
  if (!listing) return fail(404, "İlan bulunamadı.");

  if (!action && req.method === "GET") {
    const owner = await getUser(listing.userId);
    return json({ listing, owner: owner && publicUser(owner) });
  }
  if (!action && req.method === "DELETE") {
    await deleteListing(listing);
    await purgeSite();
    return json({ ok: true });
  }
  if (action === "moderate" && req.method === "POST") {
    const { status, reason } = await readJson(req, 2048);
    await moderateListing(listing, status, reason);
    await purgeSite();
    return json({ listing });
  }
  if (action === "feature" && req.method === "POST") {
    const { featured } = await readJson(req, 1024);
    await setFeatured(listing, featured);
    await purgeSite();
    return json({ listing });
  }
  return fail(404, "Bulunamadı.");
}

async function usersRoute(req, id, action) {
  if (!id && req.method === "GET") {
    const [users, index] = await Promise.all([listUsers(), readIndex()]);
    const counts = {};
    for (const x of index) {
      counts[x.userId] ??= { total: 0, active: 0, pending: 0 };
      counts[x.userId].total++;
      if (x.status === "active" || x.status === "pending") counts[x.userId][x.status]++;
    }
    return json({
      users: users.map((u) => ({ ...publicUser(u), listings: counts[u.id] || { total: 0, active: 0, pending: 0 } })),
    });
  }
  const user = await getUser(id);
  if (!user) return fail(404, "Üye bulunamadı.");

  if (action === "ban" && req.method === "POST") {
    const { banned } = await readJson(req, 1024);
    user.status = banned ? "banned" : "active";
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await saveUser(user);
    if (banned) await hideUserListings(user.id, "Hesap askıya alındı.");
    await purgeSite();
    return json({ user: publicUser(user) });
  }
  if (action === "reset-password" && req.method === "POST") {
    const password = temporaryPassword();
    await setUserPassword(user, password);
    return json({ password });
  }
  if (!action && req.method === "DELETE") {
    await deleteUserListings(user.id);
    await deleteUserRecord(user);
    await purgeSite();
    return json({ ok: true });
  }
  return fail(404, "Bulunamadı.");
}

async function reportsRoute(req, id) {
  if (!id && req.method === "GET") return json({ reports: await listReports() });
  if (!REPORT_ID.test(String(id))) return fail(404, "Şikâyet bulunamadı.");
  if (req.method === "PATCH") {
    const { status } = await readJson(req, 1024);
    return json({ report: await updateReport(id, status) });
  }
  if (req.method === "DELETE") {
    await deleteReport(id);
    return json({ ok: true });
  }
  return fail(404, "Bulunamadı.");
}

export default async (req, context) => {
  try {
    await requireAdmin(req);
    const [resource, id, action] = new URL(req.url).pathname.replace(/^\/api\/admin\/?/, "").split("/");
    if (resource === "summary" && req.method === "GET") return await summary();
    if (resource === "listings") return await listingsRoute(req, id, action);
    if (resource === "users") return await usersRoute(req, id, action);
    if (resource === "reports") return await reportsRoute(req, id);
    return fail(404, "Bulunamadı.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: "/api/admin/*" };
