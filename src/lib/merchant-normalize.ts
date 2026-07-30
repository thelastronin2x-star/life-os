/** Normalizes a bank-imported merchant title for GROUPING/display purposes —
 *  deliberately fuzzier than normalizeMerchantKey (merchant-rules-store.ts),
 *  which must stay strict since it's used for exact learned-rule lookups.
 *  Bank statement descriptions for the same real merchant often differ only
 *  by a terminal id, receipt/store number suffix (e.g. "АТБ №1234" vs "АТБ
 *  №5678", "WOG 155" vs "WOG 212"), which would otherwise split one real
 *  merchant into several separate rows in a "top merchants" ranking.
 *
 *  Only strips a trailing number when it looks like a store/terminal code,
 *  not part of the brand name itself:
 *   - an explicit "№" or "#" marker, any digit count ("АТБ №7" -> "атб")
 *   - a bare trailing run of 4+ digits with no marker (long enough to be a
 *     terminal id; short brand-embedded numbers like "Аптека 911" or
 *     "7-eleven" are left alone) */
export function normalizeMerchantForGrouping(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s*[№#]\s*\d+\s*$/u, "")
    .replace(/\s+\d{4,}\s*$/u, "")
    .trim();
}
