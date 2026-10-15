import { mediaStore } from "../lib/content.mjs";

const KEY_PATTERN = /^[a-z0-9]+-[a-f0-9]{10}\.(jpg|png|webp|gif|avif)$/;

export default async (req, context) => {
  const key = context.params?.key;
  const result = KEY_PATTERN.test(key || "") ? await mediaStore().getWithMetadata(key, { type: "stream" }) : null;
  if (!result) return new Response("Görsel bulunamadı", { status: 404, headers: { "Cache-Control": "no-store" } });

  return new Response(result.data, {
    headers: {
      "Content-Type": result.metadata?.contentType || "application/octet-stream",
      // Anahtarlar benzersiz ve görseller değişmez; uzun süre önbelleğe alınabilir.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Netlify-CDN-Cache-Control": "public, durable, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
};

export const config = { path: "/media/:key", method: ["GET", "HEAD"] };
