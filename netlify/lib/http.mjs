export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

// Başlık değeri dizi ise (ör. birden çok Set-Cookie) her biri ayrı eklenir.
export function json(data, status = 200, headers = {}) {
  const h = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  for (const [key, value] of Object.entries(headers)) {
    for (const v of [value].flat()) h.append(key, v);
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

export const fail = (status, error) => json({ error }, status);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// JSON gövdesini boyut sınırıyla okur. Content-Type kontrolü, başka sitelerden
// gönderilen basit form isteklerini (CSRF) de engeller.
export async function readJson(req, maxBytes = 64 * 1024) {
  if (!(req.headers.get("content-type") || "").includes("application/json")) {
    throw new HttpError(415, "İstek JSON olmalı.");
  }
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "İstek çok büyük.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Geçersiz JSON.");
  }
}

export function handleError(err) {
  if (err instanceof HttpError) return fail(err.status, err.message);
  console.error(err);
  return fail(500, "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
}

export const env = (name) => globalThis.Netlify?.env?.get(name) ?? process.env[name];
