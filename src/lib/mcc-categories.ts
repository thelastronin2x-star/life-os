import type { GoalColor } from "./finance-store";

export interface MccCategoryBucket {
  name: string;
  icon: string; // matches an id in CATEGORY_ICON_OPTIONS
  color: GoalColor;
}

const FOOD: MccCategoryBucket = { name: "Їжа", icon: "utensils", color: "sage" };
const TRANSPORT: MccCategoryBucket = { name: "Транспорт", icon: "car", color: "sky" };
const ENTERTAINMENT: MccCategoryBucket = { name: "Розваги", icon: "clapperboard", color: "clay" };
const SUBSCRIPTIONS: MccCategoryBucket = { name: "Підписки", icon: "smartphone", color: "gold" };
const HOME: MccCategoryBucket = { name: "Дім", icon: "house", color: "rose" };
const SHOPPING: MccCategoryBucket = { name: "Покупки", icon: "shopping-bag", color: "sky" };
const HEALTH: MccCategoryBucket = { name: "Здоров'я", icon: "pill", color: "sage" };
const EDUCATION: MccCategoryBucket = { name: "Освіта", icon: "book", color: "gold" };
const TRANSFERS: MccCategoryBucket = { name: "Перекази на картку", icon: "transfer", color: "rose" };

// Specific/override codes that would otherwise fall into the wrong broad
// range below (checked before the ranges — first match wins).
const MCC_OVERRIDES: Record<number, MccCategoryBucket> = {
  4829: TRANSFERS, // money transfer
  4812: SUBSCRIPTIONS, 4813: SUBSCRIPTIONS, 4814: SUBSCRIPTIONS, 4816: SUBSCRIPTIONS, 4821: SUBSCRIPTIONS, 4899: SUBSCRIPTIONS, // telecom/cable
  5411: FOOD, 5422: FOOD, 5441: FOOD, 5451: FOOD, 5462: FOOD, 5499: FOOD, // groceries
  5541: TRANSPORT, 5542: TRANSPORT, 5552: TRANSPORT, 5983: TRANSPORT, // fuel
  5811: FOOD, 5812: FOOD, 5813: FOOD, 5814: FOOD, // restaurants/cafes/bars
  5815: SUBSCRIPTIONS, 5816: SUBSCRIPTIONS, 5817: SUBSCRIPTIONS, 5818: SUBSCRIPTIONS, // digital goods (Netflix/Spotify/app stores)
  7372: SUBSCRIPTIONS, // software
  8398: HOME, // charity — closest fit among existing buckets
};

// Overrides pharmacies, opticians, doctors, hospitals etc. up from the
// generic Retail/Professional ranges into Health.
const HEALTH_MCC = new Set([
  5122, 5292, 5912, 5975, 5976, 8011, 8021, 8031, 8041, 8042, 8043, 8044, 8049, 8050, 8062, 8071, 8099,
]);

/** ISO 18245 merchant category codes, mapped to this app's built-in budget
 *  category buckets via broad ranges (with specific overrides checked
 *  first) — covers the full code space, so every real merchant resolves to
 *  *something* rather than sitting uncategorized. Ranges with no obviously
 *  correct bucket (agriculture, professional services, travel/hotels,
 *  government) go to the closest reasonable fit rather than null — an
 *  imperfect guess the user can fix once (which the app then remembers) beats
 *  a permanently uncategorized entry. */
export function getCategoryBucketForMcc(mcc: number): MccCategoryBucket | null {
  if (HEALTH_MCC.has(mcc)) return HEALTH;
  if (mcc in MCC_OVERRIDES) return MCC_OVERRIDES[mcc];

  if (mcc >= 1 && mcc <= 1499) return SHOPPING; // agriculture supplies — closest fit
  if (mcc >= 1500 && mcc <= 2999) return HOME; // contracted services: building/household
  if (mcc >= 3000 && mcc <= 3499) return TRANSPORT; // airlines, car rental
  if (mcc >= 3500 && mcc <= 3999) return ENTERTAINMENT; // hotels/lodging — travel & leisure
  if (mcc >= 4000 && mcc <= 4799) return TRANSPORT;
  if (mcc >= 4900 && mcc <= 4999) return HOME; // utilities
  if (mcc >= 5000 && mcc <= 5599) return SHOPPING; // retail
  if (mcc >= 5600 && mcc <= 5699) return SHOPPING; // clothing
  if (mcc >= 5700 && mcc <= 5999) return SHOPPING; // retail
  if (mcc >= 6000 && mcc <= 6999) return TRANSFERS; // financial institutions / quasi-cash / wire
  if (mcc >= 7000 && mcc <= 7299) return ENTERTAINMENT; // hotels (alt. range) / lodging services
  if (mcc >= 7300 && mcc <= 7799) return SHOPPING; // auto services, repair, misc business services
  if (mcc >= 7800 && mcc <= 7999) return ENTERTAINMENT;
  if (mcc >= 8000 && mcc <= 8099) return HEALTH;
  if (mcc >= 8100 && mcc <= 8199) return SHOPPING; // legal/accounting services
  if (mcc >= 8200 && mcc <= 8299) return EDUCATION;
  if (mcc >= 8300 && mcc <= 8999) return SHOPPING; // professional/membership/misc services
  if (mcc >= 9000 && mcc <= 9999) return HOME; // government services, taxes, fines

  return null;
}

/** Fallback for when the MCC doesn't resolve to anything (missing/generic
 *  code) but the merchant name itself is unambiguous. Keyword list is
 *  deliberately conservative — only distinctive brand names, nothing generic
 *  enough to misfire on an unrelated purchase. Checked only as a second pass,
 *  after MCC matching has already failed. */
const DESCRIPTION_KEYWORDS: { bucket: MccCategoryBucket; keywords: string[] }[] = [
  {
    bucket: SUBSCRIPTIONS,
    keywords: [
      "netflix", "spotify", "youtube", "youtube premium", "apple.com/bill", "google play",
      "google *", "icloud", "disney+", "disneyplus", "megogo", "chatgpt", "openai",
      "claude", "anthropic", "playstation network", "xbox game pass", "patreon",
    ],
  },
  { bucket: FOOD, keywords: ["сільпо", "атб", "ашан", "novus", "новус", "фора", "велика кишеня", "варус", "varus"] },
  { bucket: TRANSPORT, keywords: ["uklon", "bolt", "uber", "wog", "okko", "socar", "glusco", "укрзалізниц"] },
  { bucket: SHOPPING, keywords: ["rozetka", "розетка", "epicentr", "епіцентр", "aliexpress", "amazon"] },
  { bucket: HEALTH, keywords: ["аптека", "apteka"] },
  { bucket: HOME, keywords: ["portmone", "портмоне"] }, // Ukrainian bill-payment aggregator (utilities/mobile top-up)
  { bucket: EDUCATION, keywords: ["ftmo"] }, // prop-firm challenge fee — user chose to bucket under Education
  { bucket: ENTERTAINMENT, keywords: ["reform"] }, // user's gym/fitness membership
  {
    bucket: TRANSFERS,
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

export function getCategoryBucketForDescription(description: string): MccCategoryBucket | null {
  const lower = description.toLowerCase();
  for (const { bucket, keywords } of DESCRIPTION_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return bucket;
  }
  if (looksLikeTransferRecipient(description)) return TRANSFERS;
  return null;
}
