// Site geneli günlük SMS sınırı (SMS_DAILY_LIMIT): sınır aşılınca kod gönderilmez.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Client, startServer } from "./helpers.mjs";

let server;
before(async () => {
  server = await startServer({ SMS_DAILY_LIMIT: "2" });
});
after(() => server?.stop());

test("günlük SMS sınırı aşılınca yeni kod gönderilmez", async () => {
  const client = new Client(server.base);
  assert.equal((await client.post("/api/v1/auth/send-otp", { phone: "05321000001" })).status, 200);
  assert.equal((await client.post("/api/v1/auth/send-otp", { phone: "05321000002" })).status, 200);
  const third = await client.post("/api/v1/auth/send-otp", { phone: "05321000003" });
  assert.equal(third.status, 503);
  assert.match(third.data.error, /SMS/);
});
