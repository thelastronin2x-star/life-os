import { chromium, devices } from "playwright";
const iphone = devices["iPhone 13"];
const browser = await chromium.launch();
const page = await browser.newPage({ ...iphone });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// NO init script this time — genuinely fresh, like real incognito
await page.goto("https://life-os-00-bde0.vercel.app/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("URL after fresh load:", page.url());
console.log("body text (first 500):", (await page.locator("body").innerText()).slice(0, 500));
console.log("errors:", errors);

await browser.close();
