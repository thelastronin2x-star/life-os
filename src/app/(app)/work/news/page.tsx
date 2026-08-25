"use client";

import { WorkSubpageHeader } from "@/components/work/WorkSubpageHeader";
import { MarketNewsModule } from "@/components/work/MarketNewsModule";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";

export default function NewsPage() {
  const isTrader = useTraderOnlyGuard();
  if (!isTrader) return null;

  return (
    <div>
      <WorkSubpageHeader title="Новини ринку" subtitle="Що рухає твої ринки — переклад українською, без переходу на сторонні сайти" />
      <MarketNewsModule />
    </div>
  );
}
