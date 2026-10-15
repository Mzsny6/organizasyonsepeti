import { requireAdmin } from "../lib/auth.mjs";
import { purgeSite } from "../lib/cache.mjs";
import { getContent, listHistory, restoreHistory, saveContent } from "../lib/content.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";

export default async (req) => {
  try {
    const path = new URL(req.url).pathname;

    if (path === "/api/content" && req.method === "GET") {
      return json(await getContent());
    }

    if (path === "/api/content" && req.method === "PUT") {
      await requireAdmin(req);
      const content = await saveContent(await readJson(req, 1024 * 1024));
      await purgeSite();
      return json(content);
    }

    if (path === "/api/content/history" && req.method === "GET") {
      await requireAdmin(req);
      return json({ versions: await listHistory() });
    }

    if (path === "/api/content/restore" && req.method === "POST") {
      await requireAdmin(req);
      const { timestamp } = await readJson(req, 1024);
      const content = await restoreHistory(timestamp);
      if (!content) return fail(404, "Bu sürüm bulunamadı.");
      await purgeSite();
      return json(content);
    }

    return fail(404, "Bulunamadı.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: ["/api/content", "/api/content/history", "/api/content/restore"] };
