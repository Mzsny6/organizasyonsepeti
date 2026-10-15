import { requireAdmin } from "../lib/auth.mjs";
import { countHit, isLimited } from "../lib/limits.mjs";
import { messageStore, newId } from "../lib/content.mjs";
import { fail, handleError, json, readJson } from "../lib/http.mjs";

const FIELDS = { name: 80, phone: 30, email: 120, eventType: 120, date: 30, guests: 30, message: 3000 };
const ID_PATTERN = /^\d{13}-[a-f0-9]{10}$/;
const HOUR = 60 * 60 * 1000;

async function createMessage(req, context) {
  if (await isLimited("message", context.ip, 6, HOUR)) {
    return fail(
      429,
      "Kısa sürede çok fazla mesaj gönderildi. Lütfen biraz sonra tekrar deneyin ya da WhatsApp'tan yazın.",
    );
  }
  const body = await readJson(req, 16 * 1024);
  // Botlar için gizli alan: doluysa sessizce kabul edip kaydetmiyoruz.
  if (body.website) return json({ ok: true }, 201);

  const data = {};
  for (const [key, max] of Object.entries(FIELDS))
    data[key] = String(body[key] ?? "")
      .trim()
      .slice(0, max);

  if (data.name.length < 2) return fail(400, "Lütfen adınızı ve soyadınızı yazın.");
  if (data.phone.replace(/\D/g, "").length < 10) return fail(400, "Lütfen geçerli bir telefon numarası yazın.");
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    return fail(400, "E-posta adresi geçersiz görünüyor.");

  const id = `${Date.now()}-${newId()}`;
  await messageStore().setJSON(id, { id, ...data, read: false, createdAt: new Date().toISOString() });
  await countHit("message", context.ip, HOUR);
  return json({ ok: true }, 201);
}

async function listMessages() {
  const store = messageStore();
  const { blobs } = await store.list();
  const keys = blobs
    .map((b) => b.key)
    .filter((k) => ID_PATTERN.test(k))
    .sort()
    .reverse()
    .slice(0, 500);
  const messages = await Promise.all(keys.map((k) => store.get(k, { type: "json" })));
  return json({ messages: messages.filter(Boolean) });
}

export default async (req, context) => {
  try {
    const id = context.params?.id;

    if (!id && req.method === "POST") return await createMessage(req, context);

    await requireAdmin(req);
    if (!id && req.method === "GET") return await listMessages();
    if (!id || !ID_PATTERN.test(id)) return fail(404, "Mesaj bulunamadı.");

    const store = messageStore();
    if (req.method === "PATCH") {
      const message = await store.get(id, { type: "json" });
      if (!message) return fail(404, "Mesaj bulunamadı.");
      const { read } = await readJson(req, 1024);
      message.read = Boolean(read);
      await store.setJSON(id, message);
      return json(message);
    }
    if (req.method === "DELETE") {
      await store.delete(id);
      return json({ ok: true });
    }
    return fail(405, "Desteklenmeyen istek.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: ["/api/messages", "/api/messages/:id"] };
