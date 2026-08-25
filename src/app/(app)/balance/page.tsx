import { FinanceOverview } from "@/components/finance/FinanceOverview";

/** Здоров'я and Фінанси used to share this route via a `?segment=` toggle —
 *  now split into their own tabs (see nav-items.ts and health/page.tsx), so
 *  this route is Фінанси alone. FinanceOverview already renders its own
 *  topbar (title + settings), so there's nothing left for this page to add. */
export default function BalancePage() {
  return <FinanceOverview />;
}
