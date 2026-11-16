// Uçdan-uca yoxlama: iki berber, randevu, konflikt, tenant izolyasiyası, maliyyə, veresiyə.
// İstifadə: server işləyərkən  BASE=http://localhost:3100 npm run e2e
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
}
const { chromium, devices } = pw;

const BASE = process.env.BASE ?? "http://localhost:3100";
const SHOTS = path.join(path.dirname(new URL(import.meta.url).pathname), "screens");
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const shot = (page, file) => page.screenshot({ path: `${SHOTS}/${file}`, timeout: 10000 }).catch((e) => console.log(`  (screenshot ${file} alınmadı: ${e.message.split("\n")[0]})`));
const check = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};

const uniq = String(Date.now()).slice(-7);
const phoneA = `050${uniq}`;
const phoneB = `055${uniq}`;

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const mobile = { ...devices["Pixel 7"], locale: "az-AZ", timezoneId: "Asia/Baku" };

async function register(ctx, salon, phone, pin) {
  const page = await ctx.newPage();
  await page.goto(BASE + "/");
  check(page.url().endsWith("/giris"), `${salon}: girişsiz → /giris`);
  await page.getByRole("link", { name: "Qeydiyyat" }).click();
  await page.locator('input[name="salonName"]').fill(salon);
  await page.locator('input[name="phone"]').fill(phone);
  await page.locator('input[name="pin"]').fill(pin);
  await page.locator('input[name="pin2"]').fill(pin);
  await page.getByRole("button", { name: "Hesab yarat" }).click();
  await page.waitForURL(BASE + "/");
  check(await page.getByText(salon).first().isVisible(), `${salon}: qeydiyyat və giriş`);
  return page;
}

async function addByPhrase(page, phrase, phone) {
  await page.locator('input[name="phrase"]').fill(phrase);
  await page.getByRole("button", { name: "Əlavə et", exact: true }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  if (phone) await dlg.locator('input[name="phone"]').fill(phone);
  return dlg;
}

// ---------------- Berber A ----------------
const ctxA = await browser.newContext(mobile);
const A = await register(ctxA, "Berber Ramazan", phoneA, "1234");
await shot(A, "01-bos-teqvim.png");

let dlg = await addByPhrase(A, "Sabah saat 8-ə Şafak randevu", "050 111 22 33");
check(await dlg.getByText("Təsdiq edirsən?").isVisible(), "təsdiq ekranı göstərilir");
check((await dlg.locator('input[name="clientName"]').inputValue()) === "Şafak", "ad: Şafak");
check((await dlg.locator('input[name="time"]').inputValue()) === "08:00", "saat: 08:00");
await shot(A, "02-tesdiq.png");
await dlg.getByRole("button", { name: "✓ Təsdiq et" }).click();
await dlg.waitFor({ state: "detached" });
await A.getByText("✅ Şafak").waitFor();
check(await A.getByRole("button", { name: /08:00\s*Şafak/ }).isVisible(), "Şafak sabah 08:00 siyahıda");

// Konflikt
dlg = await addByPhrase(A, "Sabah saat 8 Elvin");
await dlg.getByRole("button", { name: "✓ Təsdiq et" }).click();
check(await dlg.getByText(/artıq Şafak var/).waitFor({ timeout: 5000 }).then(() => true, () => false), "eyni saat → xəbərdarlıq");
await shot(A, "03-konflikt.png");
await dlg.locator('input[name="time"]').fill("09:00");
await dlg.getByRole("button", { name: "✓ Təsdiq et" }).click();
await dlg.waitFor({ state: "detached" });

// Ad yoxdursa təxmin etmir
dlg = await addByPhrase(A, "sabah saat 10 randevu");
check(await dlg.getByText(/adı başa düşmədim/).isVisible(), "ad yoxdur → soruşur");
check(await dlg.getByRole("button", { name: "✓ Təsdiq et" }).isDisabled(), "ad yoxdursa təsdiq bağlıdır");
await dlg.getByRole("button", { name: "Bağla" }).click();

// Təkrar müştəri → nömrə avtomatik
dlg = await addByPhrase(A, "Cümə axşamı saat 12-yə Şafak");
await A.waitForTimeout(800);
check((await dlg.locator('input[name="phone"]').inputValue()) === "050 111 22 33", "təkrar müştəri: nömrə avtomatik doldu");
await dlg.getByRole("button", { name: "✓ Təsdiq et" }).click();
await dlg.waitFor({ state: "detached" });

// Bu gün
dlg = await addByPhrase(A, "Bu gün saat 17:30 Nicat", "0502223344");
await dlg.getByRole("button", { name: "✓ Təsdiq et" }).click();
await dlg.waitFor({ state: "detached" });
const wa = await A.getByRole("link", { name: "Nicat — WhatsApp xatırlatma" }).getAttribute("href");
check(wa?.startsWith("https://wa.me/994502223344?text=") && decodeURIComponent(wa).includes("bu gün"), "wa.me linki düzgün");
await shot(A, "04-bu-gun.png");

// Gəldi → gəlir
await A.getByRole("button", { name: "Nicat gəldi" }).click();
dlg = A.getByRole("dialog");
await dlg.getByRole("button", { name: "15 ₼" }).click();
await dlg.getByRole("button", { name: "Yadda saxla" }).click();
await dlg.waitFor({ state: "detached" });

// Maliyyə
await A.getByRole("link", { name: "Gəlir-gedir" }).click();
await A.waitForURL(/maliyye/);
await A.getByPlaceholder("Açıqlama (saç, saqqal, ülgü...)").fill("Ülgü bıçaqları");
await A.getByPlaceholder("AZN").fill("4,5");
await A.getByRole("button", { name: "− Xərc" }).click();
await A.getByText("Ülgü bıçaqları").waitFor();
const stats = await A.locator(".grid-cols-3").innerText();
check(stats.includes("15 ₼") && stats.includes("4,50 ₼") && stats.includes("10,50 ₼"), "gəlir 15, xərc 4,50, xalis 10,50");
await shot(A, "05-maliyye.png");

// Veresiyə → ödəndi → gəlir
await A.getByRole("link", { name: "Veresiyə" }).click();
await A.waitForURL(/veresiye/);
await A.locator('input[name="clientName"]').fill("Rövşən");
await A.getByPlaceholder("AZN").fill("20");
await A.getByRole("button", { name: "+ Veresiyə yaz" }).click();
await A.getByText("Ödənməyib").waitFor();
check((await A.getByText("Ümumi veresiyə").locator("..").innerText()).includes("20 ₼"), "veresiyə 20 ₼");
await shot(A, "06-veresiye.png");
A.once("dialog", (d) => d.accept());
await A.getByRole("button", { name: "Rövşən ödədi" }).click();
await A.getByText("Ödənib").waitFor();
await A.getByRole("link", { name: "Gəlir-gedir" }).click();
await A.getByText("Veresiyə ödənişi: Rövşən").waitFor();
check((await A.locator(".grid-cols-3").innerText()).includes("35 ₼"), "veresiyə ödənişi gəlirə yazıldı (15+20=35)");

// Müştərilər
await A.getByRole("link", { name: "Müştərilər" }).click();
await A.waitForURL(/musteriler/);
check(await A.getByText("Şafak").isVisible(), "müştəri siyahısında Şafak");
await shot(A, "07-musteriler.png");

// ---------------- Səs (Mərhələ 2) ----------------
await A.goto(BASE + "/");
let voiceReq = null;
await A.route("**/api/voice", async (route) => {
  voiceReq = route.request();
  // Whisper "Tofiq"i səhv tanıdı ("Tofik") — berber təsdiq ekranında düzəltməlidir
  await route.fulfill({ json: { transcript: "Cümə axşamı saat 12-yə Tofik", name: "Tofik", date: null, time: "12:00", question: null, source: "llm" } });
});
await ctxA.grantPermissions(["microphone"], { origin: BASE });
const mic = A.getByRole("button", { name: "Danış" });
const mb = await mic.boundingBox();
await A.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
await A.mouse.down();
await A.getByText(/Dinləyirəm/).waitFor();
await A.waitForTimeout(1500);
await A.mouse.up();
dlg = A.getByRole("dialog");
await dlg.waitFor();
const body = voiceReq ? voiceReq.postDataBuffer() : null;
check(!!body && body.length > 1000 && /audio\/(webm|ogg|mp4)/.test(body.toString("latin1")), "səs yazıldı və /api/voice-a audio getdi");
check(await dlg.getByText("«Cümə axşamı saat 12-yə Tofik»").isVisible(), "təsdiq ekranında eşidilən mətn göstərilir");
check((await dlg.locator('input[name="time"]').inputValue()) === "12:00", "səs: saat 12:00");
await shot(A, "09-ses-tesdiq.png");
await dlg.locator('input[name="clientName"]').fill("Tofiq");
await dlg.getByRole("button", { name: "✓ Təsdiq et" }).click();
await dlg.waitFor({ state: "detached" });
check(await A.getByRole("button", { name: /^12:00\s*Tofiq/ }).waitFor({ timeout: 5000 }).then(() => true, () => false), "yanlış tanınan ad düzəldilib yadda saxlanıldı");
await A.unroute("**/api/voice");

// Real endpoint: girişsiz 401, açar yoxdursa aydın mesaj
const anon = await fetch(BASE + "/api/voice", { method: "POST" });
check(anon.status === 401, "/api/voice girişsiz → 401");
if (!process.env.OPENAI_API_KEY) {
  const r = await A.request.post(BASE + "/api/voice", { multipart: { audio: { name: "v.webm", mimeType: "audio/webm", buffer: Buffer.alloc(2000) } } });
  check(r.status() === 503 && (await r.json()).error.includes("qoşulmayıb"), "açar yoxdursa: 503 + yazı ilə əlavə et mesajı");
}

// ---------------- Berber B (ayrı brauzer) ----------------
const ctxB = await browser.newContext(mobile);
const B = await register(ctxB, "Tural Barbershop", phoneB, "5678");
const tomorrowTab = B.getByRole("tab").nth(1);
await tomorrowTab.click();
check(await B.getByText("0 randevu").isVisible() && !(await B.getByRole("button", { name: /^\d\d:\d\d\s*Şafak/ }).count()), "B: A-nın sabahkı randevusunu görmür");
await B.getByRole("tab").nth(0).click();
await B.getByRole("tab", { selected: true }).filter({ hasText: "Bu gün" }).waitFor();
check(await B.getByText("0 randevu").isVisible() && !(await B.getByRole("button", { name: /^\d\d:\d\d\s*Nicat/ }).count()), "B: A-nın bugünkü randevusunu görmür");
await B.goto(BASE + "/musteriler");
check(await B.getByText("Hələ müştəri yoxdur").isVisible(), "B: A-nın müştərilərini görmür");
await B.goto(BASE + "/maliyye");
check(!(await B.getByText("Ülgü bıçaqları").count()), "B: A-nın maliyyəsini görmür");
await B.goto(BASE + "/veresiye");
check(!(await B.getByText("Rövşən").count()), "B: A-nın veresiyəsini görmür");
// Avtomatik doldurma B üçün A-nın müştərisini təklif etmir
await B.goto(BASE + "/");
dlg = await addByPhrase(B, "Sabah saat 3-də Şafak");
await B.waitForTimeout(800);
check((await dlg.locator('input[name="phone"]').inputValue()) === "", "B: A-nın müştəri nömrəsi təklif olunmur");
check((await dlg.locator('input[name="time"]').inputValue()) === "15:00", "saat 3 → 15:00");
await dlg.getByRole("button", { name: "✓ Təsdiq et" }).click();
await dlg.waitFor({ state: "detached" });
await shot(B, "08-berber-b.png");

// Çıxış və səhv PIN
await B.goto(BASE + "/ayarlar");
await B.getByRole("button", { name: "Çıxış" }).click();
await B.waitForURL(/giris/);
await B.locator('input[name="phone"]').fill(phoneB);
await B.locator('input[name="pin"]').fill("0000");
await B.getByRole("button", { name: "Daxil ol" }).click();
check(await B.getByText("Nömrə və ya PIN səhvdir").waitFor({ timeout: 5000 }).then(() => true, () => false), "səhv PIN rədd edilir");
check((await B.locator('input[name="phone"]').inputValue()) === phoneB, "səhv PIN-dən sonra nömrə silinmir");
await B.locator('input[name="pin"]').fill("5678");
await B.getByRole("button", { name: "Daxil ol" }).click();
await B.waitForURL(BASE + "/");
check(true, "düzgün PIN ilə yenidən giriş");

// PWA manifest
const man = await (await fetch(BASE + "/manifest.webmanifest")).json();
check(man.display === "standalone" && man.icons.length >= 2, "manifest: standalone + ikonlar");
check((await fetch(BASE + "/sw.js")).ok, "service worker mövcuddur");

await browser.close();
console.log(failures ? `\n${failures} yoxlama UĞURSUZ` : "\nBütün yoxlamalar keçdi");
process.exit(failures ? 1 : 0);
