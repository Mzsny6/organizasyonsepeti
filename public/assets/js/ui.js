// Yönetim paneli ve üye hesabı için ortak arayüz yardımcıları.
import { icon } from "/assets/js/icons.js";

// Güvenli DOM oluşturucu: metinler her zaman textContent olarak eklenir.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "html")
      el.innerHTML = value; // yalnızca güvenilir (ikon) içerik
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "value" || key === "checked" || key === "selected" || key === "open") el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

// replaceChildren, null/false değerleri "null" yazısına çevirdiği için önce temizlenir.
export const fill = (el, ...kids) =>
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));

export const ic = (name, cls = "icon") =>
  h("span", { class: "icon-wrap", html: icon(name, cls), "aria-hidden": "true" });

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
export const fmtSize = (bytes) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
export const fmtPrice = (n) => (n ? `${Number(n).toLocaleString("tr-TR")} ₺` : "");

export function toast(message, type = "info") {
  let box = document.getElementById("toasts");
  if (!box) document.body.append((box = h("div", { id: "toasts", class: "toasts", "aria-live": "polite" })));
  const el = h("div", { class: `toast toast-${type}`, role: type === "error" ? "alert" : "status" }, message);
  box.append(el);
  setTimeout(() => el.classList.add("is-leaving"), 3800);
  setTimeout(() => el.remove(), 4200);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

export async function api(path, { method = "GET", body, headers = {}, quiet401 = false } = {}) {
  const isJson = body !== undefined && !(body instanceof Blob);
  const res = await fetch(path, {
    method,
    headers: isJson ? { "Content-Type": "application/json", ...headers } : headers,
    body: isJson ? JSON.stringify(body) : body,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !quiet401) onUnauthorized(data.error);
  if (!res.ok) throw new ApiError(res.status, data.error || "İşlem başarısız oldu.");
  return data;
}

// Telefondan gelen büyük fotoğrafları yüklemeden önce küçültür (en fazla 2000 px, WebP/JPEG).
export async function prepareImage(file) {
  if (file.type === "image/gif") return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));
  let blob = await toBlob("image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.86);
  return blob && (blob.size < file.size || scale < 1) ? blob : file;
}

export async function uploadImage(file) {
  const prepared = await prepareImage(file);
  if (prepared.size > 5 * 1024 * 1024) throw new Error(`${file.name}: fotoğraf 5 MB'tan büyük.`);
  const result = await api("/api/media", {
    method: "POST",
    body: prepared,
    headers: { "Content-Type": prepared.type || file.type, "X-File-Name": encodeURIComponent(file.name) },
  });
  return result.url;
}

export function pickFiles({ multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept: "image/*", multiple });
    input.addEventListener("change", () => resolve([...input.files]));
    input.click();
  });
}

// Yüklenen görselin küçük önizlemesi (Netlify Image CDN; yerelde orijinali döner).
export const thumbUrl = (url, w = 400, h = 300) =>
  url.startsWith("/media/") ? `/.netlify/images?url=${encodeURIComponent(url)}&w=${w}&h=${h}&fit=cover&q=75` : url;
