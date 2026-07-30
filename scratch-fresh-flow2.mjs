import { chromium, devices } from "playwright";
const iphone = devices["iPhone 13"];
const browser = await chromium.launch();
const page = await browser.newPage({ ...iphone });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("https://life-os-00-bde0.vercel.app/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

console.log("=== clicking continue with Trader profile ===");
await page.locator('text=Продовжити з профілем').click();
await page.waitForTimeout(1000);
console.log("URL after onboarding:", page.url());

console.log("=== navigating to Робота tab ===");
await page.locator('nav a:has-text("Робота")').click();
await page.waitForTimeout(800);
console.log("URL:", page.url());
console.log("body (first 600):", (await page.locator("body").innerText()).slice(0, 600));

console.log("=== looking for journal link ===");
const journalLink = page.locator('a[href="/work/journal"]');
console.log("journal link count:", await journalLink.count());
if (await journalLink.count() > 0) {
  await journalLink.first().click();
  await page.waitForTimeout(800);
  console.log("URL:", page.url());
  console.log("journal page body (first 500):", (await page.locator("body").innerText()).slice(0, 500));
}

console.log("errors:", errors);
await browser.close();
