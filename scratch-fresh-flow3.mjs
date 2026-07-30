import { chromium, devices } from "playwright";
const iphone = devices["iPhone 13"];
const browser = await chromium.launch();
const page = await browser.newPage({ ...iphone });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("https://life-os-00-bde0.vercel.app/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.locator('text=Продовжити з профілем').click();
await page.waitForTimeout(1000);
console.log("URL after onboarding:", page.url());

await page.goto("https://life-os-00-bde0.vercel.app/work", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("=== /work page body ===");
console.log((await page.locator("body").innerText()).slice(0, 700));

await page.goto("https://life-os-00-bde0.vercel.app/work/journal", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("=== /work/journal page body ===");
console.log((await page.locator("body").innerText()).slice(0, 700));

console.log("errors:", errors);
await browser.close();
