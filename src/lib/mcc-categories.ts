import type { FinanceCategoryKey } from "./finance-categories";

// Specific/override codes that would otherwise fall into the wrong broad
// range below (checked before the ranges — first match wins).
const MCC_OVERRIDES: Record<number, FinanceCategoryKey> = {
  4121: "taxi", // taxicabs/limousines
  4829: "transfers", // money transfer
  4900: "utilities", // electric, gas, water, sanitary
  4812: "telecom", 4813: "telecom", 4814: "telecom", 4821: "telecom", 4816: "telecom", // telecom equipment/services, telegraph, network services
  4899: "subscriptions", // cable/satellite/pay TV — streaming-equivalent, not a phone bill
  5411: "groceries", 5422: "groceries", 5441: "groceries", 5451: "groceries", 5462: "groceries", 5499: "groceries",
  5541: "car", 5542: "car", 5552: "car", 5983: "car", // fuel
  5732: "tech", // electronics stores
  5811: "restaurant", 5812: "restaurant", 5813: "restaurant", 5814: "restaurant",
  5815: "subscriptions", 5816: "subscriptions", 5817: "subscriptions", 5818: "subscriptions", // digital goods (Netflix/Spotify/app stores)
  5941: "sport", // sporting goods stores
  5942: "education", // book stores
  5945: "entertainment", // hobby/toy/game shops
  5946: "tech", // camera/photo stores
  5992: "home", // florists
  5995: "pets", // pet stores/supplies
  7372: "subscriptions", // software licenses
  7622: "tech", // electronics repair
  7933: "sport", // bowling
  7992: "sport", // golf courses
  7997: "sport", // membership sports/fitness clubs (gyms)
  8398: "home", // charity — no dedicated bucket, closest to general household giving
  8675: "car", // automobile clubs
};

// Overrides pharmacies, opticians, doctors, hospitals etc. up from the
// generic Retail/Professional ranges into Health.
const HEALTH_MCC = new Set([
  5122, 5292, 5912, 5975, 5976, 8011, 8021, 8031, 8041, 8042, 8043, 8044, 8049, 8050, 8062, 8071, 8099,
]);

/** ISO 18245 merchant category codes, mapped to this app's fixed budget
 *  categories (see finance-categories.ts) via broad ranges, with specific
 *  overrides checked first — covers the full code space, so every real
 *  merchant resolves to *something* rather than sitting uncategorized.
 *  Ranges with no obviously correct bucket (agriculture, professional
 *  services, government) go to the closest reasonable fit rather than null
 *  — an imperfect guess the user can fix once (which the app then remembers
 *  via learnMerchantRule) beats a permanently uncategorized entry. */
export function getCategoryBucketForMcc(mcc: number): FinanceCategoryKey | null {
  if (HEALTH_MCC.has(mcc)) return "health";
  if (mcc in MCC_OVERRIDES) return MCC_OVERRIDES[mcc];

  if (mcc >= 1 && mcc <= 1499) return "home"; // agriculture supplies — closest fit
  if (mcc >= 1500 && mcc <= 2999) return "home"; // contracted services: building/household
  if (mcc >= 3000 && mcc <= 3299) return "travel"; // airlines
  if (mcc >= 3300 && mcc <= 3499) return "car"; // car rental
  if (mcc >= 3500 && mcc <= 3999) return "travel"; // hotels/lodging
  if (mcc >= 4000 && mcc <= 4099) return "travel"; // railroads
  if (mcc >= 4100 && mcc <= 4799) return "car"; // ground transport (taxi/utilities already overridden above)
  if (mcc >= 4900 && mcc <= 4999) return "utilities";
  if (mcc >= 5000 && mcc <= 5399) return "home"; // wholesale, building materials, department/variety stores
  if (mcc >= 5400 && mcc <= 5499) return "groceries";
  if (mcc >= 5500 && mcc <= 5599) return "car"; // automotive dealers
  if (mcc >= 5600 && mcc <= 5699) return "clothes";
  if (mcc >= 5700 && mcc <= 5799) return "home"; // furniture, appliances, home furnishings
  if (mcc >= 5800 && mcc <= 5899) return "restaurant";
  if (mcc >= 5900 && mcc <= 5999) return "home"; // misc retail
  if (mcc >= 6000 && mcc <= 6999) return "transfers"; // financial institutions / quasi-cash / wire
  if (mcc >= 7000 && mcc <= 7099) return "travel"; // hotels (alt. range)
  if (mcc >= 7100 && mcc <= 7299) return "travel"; // lodging-adjacent, recreational services
  if (mcc >= 7300 && mcc <= 7599) return "car"; // auto rental/repair/parking/towing, misc business services
  if (mcc >= 7600 && mcc <= 7699) return "home"; // misc repair services
  if (mcc >= 7700 && mcc <= 7999) return "entertainment";
  if (mcc >= 8000 && mcc <= 8099) return "health";
  if (mcc >= 8100 && mcc <= 8199) return "home"; // legal/accounting services
  if (mcc >= 8200 && mcc <= 8299) return "education";
  if (mcc >= 8300 && mcc <= 8999) return "home"; // professional/membership/misc services
  if (mcc >= 9000 && mcc <= 9999) return "home"; // government services, taxes, fines

  return null;
}

/** Fallback for when the MCC doesn't resolve to anything (missing/generic
 *  code) but the merchant name itself is unambiguous. Keyword list is
 *  deliberately conservative — only distinctive brand names, nothing generic
 *  enough to misfire on an unrelated purchase. Checked only as a second pass,
 *  after MCC matching has already failed. */
const DESCRIPTION_KEYWORDS: { bucket: FinanceCategoryKey; keywords: string[] }[] = [
  {
    bucket: "subscriptions",
    keywords: [
      "netflix", "spotify", "youtube", "youtube premium", "apple.com/bill", "google play",
      "google *", "icloud", "disney+", "disneyplus", "megogo", "chatgpt", "openai",
      "claude", "anthropic", "playstation network", "xbox game pass", "patreon",
    ],
  },
  { bucket: "groceries", keywords: ["сільпо", "атб", "ашан", "novus", "новус", "фора", "велика кишеня", "варус", "varus"] },
  { bucket: "coffee", keywords: ["aroma kava", "арома кава", "starbucks", "costa coffee", "lavazza", "one love coffee"] },
  { bucket: "taxi", keywords: ["uklon", "bolt", "uber"] },
  { bucket: "car", keywords: ["wog", "okko", "socar", "glusco"] },
  { bucket: "travel", keywords: ["укрзалізниц", "booking.com", "airbnb", "wizz air", "ryanair", "flyuia"] },
  { bucket: "telecom", keywords: ["kyivstar", "київстар", "vodafone", "lifecell", "life:)"] },
  { bucket: "tech", keywords: ["rozetka", "розетка", "aliexpress", "amazon"] },
  { bucket: "home", keywords: ["epicentr", "епіцентр", "portmone", "портмоне"] }, // portmone: Ukrainian bill-payment aggregator (utilities/mobile top-up)
  { bucket: "health", keywords: ["аптека", "apteka"] },
  { bucket: "education", keywords: ["ftmo"] }, // prop-firm challenge fee — user chose to bucket under Education
  { bucket: "sport", keywords: ["reform"] }, // user's gym/fitness membership
  {
    bucket: "transfers",
    keywords: [
      "переказ на картку", "переказ коштів", "переказ з картки", "переказ від", "переказ отримано",
      "зарахування переказу", "поповнення картки", "поповнення рахунку", "card2card", "card to card",
      "p2p", "п2п", "фоп", // FOP (sole-proprietor) payments have no single real category — user chose to bucket them here
    ],
  },
];

// Common contact labels for P2P transfers (a relationship name instead of a
// legal name or masked card number) — Monobank shows whatever the sender
// saved the recipient as. Matched as the WHOLE description, not a substring
// — "син" (son) or "тато" (dad) as a substring check would misfire on real
// brand names like "Синевір" or "Татомир".
const TRANSFER_CONTACT_LABELS = new Set([
  "брат", "сестра", "мама", "тато", "батько", "дружина", "чоловік", "донька", "син",
]);

// Monobank's own display conventions for a P2P card-transfer counterparty
// who hasn't set a public name — it shows either their name ("Ім'я П.": a
// capitalized first name + single capitalized last-initial + period) or,
// for a transfer straight to a card number, the masked PAN itself
// ("414950****1046"). Real merchant names essentially never take either
// shape, so both are safe signals — this is what actually catches
// transfers, since the description carries no fixed "transfer" wording at
// all in either case.
const PERSON_NAME_PATTERN = /^[\p{Lu}][\p{Ll}'’-]+\s[\p{Lu}]\.?$/u;
const MASKED_CARD_PATTERN = /^\d{4,6}\*{2,6}\d{2,4}$/;

function looksLikeTransferRecipient(description: string): boolean {
  const trimmed = description.trim();
  return (
    PERSON_NAME_PATTERN.test(trimmed) ||
    MASKED_CARD_PATTERN.test(trimmed) ||
    TRANSFER_CONTACT_LABELS.has(trimmed.toLowerCase())
  );
}

export function getCategoryBucketForDescription(description: string): FinanceCategoryKey | null {
  const lower = description.toLowerCase();
  for (const { bucket, keywords } of DESCRIPTION_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return bucket;
  }
  if (looksLikeTransferRecipient(description)) return "transfers";
  return null;
}
