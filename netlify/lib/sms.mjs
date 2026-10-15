// SMS gönderimi ve tek kullanımlık doğrulama kodları (OTP).
// Sağlayıcı: Netgsm (SMS_PROVIDER=netgsm, NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_HEADER).
// Geliştirme için SMS_TEST_MODE=1: SMS gönderilmez, kod sunucu kaydına (log) yazılır.
import { getStore } from "@netlify/blobs";
import { randomInt } from "node:crypto";
import { safeEqual, sha256 } from "./crypto.mjs";
import { HttpError, env } from "./http.mjs";
import { MINUTE, HOUR, DAY, countHit, isLimited } from "./limits.mjs";

const otpStore = () => getStore({ name: "otp", consistency: "strong" });
const CODE_TTL = 5 * MINUTE;
const MAX_ATTEMPTS = 5;

export const smsTestMode = () => env("SMS_TEST_MODE") === "1";
export const smsConfigured = () =>
  smsTestMode() ||
  (env("SMS_PROVIDER") === "netgsm" &&
    Boolean(env("NETGSM_USERCODE") && env("NETGSM_PASSWORD") && env("NETGSM_HEADER")));

async function deliver(mobile, text) {
  if (smsTestMode()) {
    console.log(`[SMS TEST] ${mobile}: ${text}`);
    return;
  }
  if (env("SMS_PROVIDER") !== "netgsm") throw new HttpError(503, "SMS servisi henüz yapılandırılmadı.");
  const params = new URLSearchParams({
    usercode: env("NETGSM_USERCODE"),
    password: env("NETGSM_PASSWORD"),
    gsmno: mobile.slice(2),
    message: text,
    msgheader: env("NETGSM_HEADER"),
    dil: "TR",
  });
  const res = await fetch(`https://api.netgsm.com.tr/sms/send/get?${params}`);
  const body = (await res.text()).trim();
  // Netgsm başarılı gönderimde "00 <görev no>" (ya da 01/02) döner; diğer kodlar hatadır.
  if (!res.ok || !/^0[0-2]\b/.test(body)) {
    console.error("Netgsm hata yanıtı:", body.slice(0, 40));
    throw new HttpError(502, "SMS şu an gönderilemedi. Lütfen biraz sonra tekrar deneyin.");
  }
}

export async function sendOtp(mobile, ip) {
  if ((await isLimited("otp-phone", mobile, 3, 10 * MINUTE)) || (await isLimited("otp-phone-day", mobile, 8, DAY))) {
    throw new HttpError(429, "Bu numaraya çok fazla kod gönderildi. Lütfen biraz sonra tekrar deneyin.");
  }
  if (await isLimited("otp-ip", ip, 12, HOUR))
    throw new HttpError(429, "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.");
  const code = String(randomInt(100000, 1000000));
  await otpStore().setJSON(sha256(mobile), {
    hash: sha256(`${mobile}:${code}`),
    expires: Date.now() + CODE_TTL,
    attempts: 0,
  });
  await deliver(mobile, `Organizasyon Sepeti doğrulama kodunuz: ${code}. Bu kodu kimseyle paylaşmayın.`);
  await Promise.all([
    countHit("otp-phone", mobile, 10 * MINUTE),
    countHit("otp-phone-day", mobile, DAY),
    countHit("otp-ip", ip, HOUR),
  ]);
}

export async function verifyOtp(mobile, code) {
  const store = otpStore();
  const key = sha256(mobile);
  const record = await store.get(key, { type: "json" });
  if (!record || Date.now() > record.expires) throw new HttpError(400, "Kodun süresi dolmuş. Lütfen yeni kod isteyin.");
  if (record.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Çok fazla hatalı deneme. Lütfen yeni kod isteyin.");
  if (!safeEqual(record.hash, sha256(`${mobile}:${String(code || "").trim()}`))) {
    record.attempts += 1;
    await store.setJSON(key, record);
    throw new HttpError(400, "Kod hatalı. Lütfen SMS ile gelen 6 haneli kodu yazın.");
  }
  await store.delete(key);
}
