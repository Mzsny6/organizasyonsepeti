import { requireAdmin } from "../lib/auth.mjs";
import { getContent, mediaStore, newId, usedMediaKeys } from "../lib/content.mjs";
import { HttpError, fail, handleError, json } from "../lib/http.mjs";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const KEY_PATTERN = /^[a-z0-9]+-[a-f0-9]{10}\.(jpg|png|webp|gif|avif)$/;

// Dosyanın gerçekten bir görsel olduğunu ilk baytlarından anlar (SVG bilerek kabul edilmez).
function detectImage(bytes) {
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return { ext: "png", type: "image/png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", type: "image/webp" };
  if (ascii(0, 4) === "GIF8") return { ext: "gif", type: "image/gif" };
  if (ascii(4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(8, 12))) return { ext: "avif", type: "image/avif" };
  return null;
}

async function upload(req) {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES) throw new HttpError(413, "Görsel en fazla 5 MB olabilir.");
  if (!(req.headers.get("content-type") || "").startsWith("image/"))
    throw new HttpError(415, "Yalnızca görsel yüklenebilir.");

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "Görsel en fazla 5 MB olabilir.");
  const image = detectImage(bytes);
  if (!image) throw new HttpError(415, "Desteklenen biçimler: JPG, PNG, WEBP, GIF, AVIF.");

  const name = decodeURIComponent(req.headers.get("x-file-name") || "").slice(0, 120);
  const key = `${Date.now().toString(36)}-${newId()}.${image.ext}`;
  await mediaStore().set(key, bytes, {
    metadata: { contentType: image.type, size: bytes.length, name, uploadedAt: new Date().toISOString() },
  });
  return json({ key, url: `/media/${key}` }, 201);
}

async function list() {
  const store = mediaStore();
  const [{ blobs }, content] = await Promise.all([store.list(), getContent()]);
  const used = usedMediaKeys(content);
  const items = await Promise.all(
    blobs.map(async ({ key }) => {
      const meta = (await store.getMetadata(key))?.metadata || {};
      return { key, url: `/media/${key}`, inUse: used.has(key), ...meta };
    }),
  );
  items.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  return json({ items });
}

export default async (req, context) => {
  try {
    await requireAdmin(req);
    const key = context.params?.key;
    if (!key && req.method === "GET") return await list();
    if (!key && req.method === "POST") return await upload(req);
    if (key && req.method === "DELETE") {
      if (!KEY_PATTERN.test(key)) return fail(404, "Görsel bulunamadı.");
      if (usedMediaKeys(await getContent()).has(key)) {
        return fail(409, "Bu görsel sitede kullanılıyor. Önce kullanıldığı yerden kaldırın.");
      }
      await mediaStore().delete(key);
      return json({ ok: true });
    }
    return fail(405, "Desteklenmeyen istek.");
  } catch (err) {
    return handleError(err);
  }
};

export const config = { path: ["/api/media", "/api/media/:key"] };
