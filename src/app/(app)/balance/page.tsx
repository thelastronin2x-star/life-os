"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FinanceOverview } from "@/components/finance/FinanceOverview";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { HeartIcon, WalletIcon } from "@/components/icons";

type Segment = "health" | "finance";

function BalanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const segment: Segment = searchParams.get("segment") === "finance" ? "finance" : "health";

  function setSegment(next: Segment) {
    router.replace(`/balance?segment=${next}`);
  }

  return (
    <div>
      <div className="pb-3.5 pt-2">
        <div className="font-heading text-lg font-semibold text-text">Баланс</div>
        <div className="mt-0.5 text-[11.5px] text-text-faint">здоров&apos;я та фінанси</div>
      </div>

      <div className="mb-3.5 flex rounded-xl border border-border bg-surface p-1">
        {(
          [
            { id: "health" as const, label: "Здоров'я", Icon: HeartIcon },
            { id: "finance" as const, label: "Фінанси", Icon: WalletIcon },
          ]
        ).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSegment(opt.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-center text-xs font-semibold",
              segment === opt.id ? "bg-surface-2 text-text" : "text-text-faint"
            )}
          >
            <opt.Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        ))}
      </div>

      {segment === "finance" ? (
        <FinanceOverview />
      ) : (
        <Card className="py-10 text-center">
          <HeartIcon className="mx-auto mb-2 h-8 w-8 text-text-faint" />
          <div className="text-[13px] font-semibold text-text">Скоро тут</div>
          <div className="mt-1 text-[11.5px] text-text-faint">Здоров&apos;я — наступний етап</div>
        </Card>
      )}
    </div>
  );
}

export default function BalancePage() {
  return (
    <Suspense fallback={null}>
      <BalanceInner />
    </Suspense>
  );
}
