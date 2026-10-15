// Siparişler: ilan paketi ve doping satın alımları.
// Kartla ödeme altyapısı (iyzico/PayTR) bağlanana kadar ödemeler havale/EFT ile alınır ve panelden onaylanır.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { HttpError } from "./http.mjs";
import { addCredit, addDoping, getListing, setAwaitingOrder } from "./listings.mjs";
import { DOPINGS, PACKAGES, applyDiscount, dopingPrice, packagePrice } from "./pricing.mjs";
import { checkPromo, redeemPromo } from "./promos.mjs";

const orderStore = () => getStore({ name: "orders", consistency: "strong" });
export const ORDER_ID = /^\d{13}-[a-f0-9]{8}$/;
export const ORDER_STATUSES = { awaiting: "Ödeme bekleniyor", paid: "Ödendi", cancelled: "İptal edildi" };

// Ödeme öncesi fiyat hesabı (kod kullanılmaz, yalnızca kontrol edilir).
export async function quote(content, { category, type, item, promoCode, userId }) {
  let price;
  let days;
  let label;
  if (type === "package") {
    if (!PACKAGES[item]) throw new HttpError(400, "Lütfen bir ilan paketi seçin.");
    price = packagePrice(content, category, item);
    days = PACKAGES[item].days;
    label = `${PACKAGES[item].label} ilan paketi`;
  } else if (type === "doping") {
    if (!DOPINGS[item]) throw new HttpError(400, "Geçersiz doping.");
    price = dopingPrice(content, item);
    days = content.pricing.dopings[item].days;
    label = DOPINGS[item].label;
  } else {
    throw new HttpError(400, "Geçersiz sipariş türü.");
  }
  let promo = null;
  if (promoCode) {
    if (type !== "package") throw new HttpError(400, "İndirim kodları yalnızca ilan paketlerinde geçerlidir.");
    promo = await checkPromo(promoCode, { pkg: item, userId });
  }
  const amount = promo ? applyDiscount(price, promo.discountPercent) : price;
  return {
    type,
    item,
    label,
    days,
    price,
    discount: price - amount,
    amount,
    promo: promo?.code || "",
    discountPercent: promo?.discountPercent || 0,
  };
}

export async function createOrder(content, user, listing, { type, item, promoCode }) {
  const q = await quote(content, { category: listing.category, type, item, promoCode, userId: user.id });
  if (type === "package" && listing.awaitingOrder) {
    throw new HttpError(409, "Bu ilan için ödemesi beklenen bir paket siparişi zaten var.");
  }
  if (q.promo) await redeemPromo(q.promo, user.id);
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();
  const order = {
    id,
    no: `OS-${id.slice(-8).toUpperCase()}`,
    userId: user.id,
    company: user.company,
    listingId: listing.id,
    listingTitle: listing.title,
    type: q.type,
    item: q.item,
    label: q.label,
    days: q.days,
    price: q.price,
    discount: q.discount,
    amount: q.amount,
    promo: q.promo,
    status: q.amount === 0 ? "paid" : "awaiting",
    createdAt: now,
    paidAt: q.amount === 0 ? now : "",
  };
  await orderStore().setJSON(id, order);
  if (order.status === "paid") await applyOrder(order, listing);
  else if (type === "package") await setAwaitingOrder(listing, id);
  return order;
}

async function applyOrder(order, listing) {
  listing ||= await getListing(order.listingId);
  if (!listing) return;
  if (order.type === "package") await addCredit(listing, order.days);
  else await addDoping(listing, order.item, order.days);
}

export async function getOrder(id) {
  if (!ORDER_ID.test(String(id))) return null;
  return orderStore().get(id, { type: "json" });
}

export async function confirmOrder(id) {
  const order = await getOrder(id);
  if (!order) throw new HttpError(404, "Sipariş bulunamadı.");
  if (order.status !== "awaiting") throw new HttpError(400, "Bu sipariş ödeme beklemiyor.");
  order.status = "paid";
  order.paidAt = new Date().toISOString();
  await orderStore().setJSON(order.id, order);
  await applyOrder(order);
  return order;
}

export async function cancelOrder(id) {
  const order = await getOrder(id);
  if (!order) throw new HttpError(404, "Sipariş bulunamadı.");
  if (order.status !== "awaiting") throw new HttpError(400, "Yalnızca ödeme bekleyen siparişler iptal edilebilir.");
  order.status = "cancelled";
  await orderStore().setJSON(order.id, order);
  const listing = await getListing(order.listingId);
  if (listing?.awaitingOrder === order.id) await setAwaitingOrder(listing, "");
  return order;
}

export async function listOrders({ userId } = {}) {
  const store = orderStore();
  const { blobs } = await store.list();
  const keys = blobs
    .map((b) => b.key)
    .sort()
    .reverse()
    .slice(0, 1000);
  const orders = (await Promise.all(keys.map((k) => store.get(k, { type: "json" })))).filter(Boolean);
  return userId ? orders.filter((o) => o.userId === userId) : orders;
}
