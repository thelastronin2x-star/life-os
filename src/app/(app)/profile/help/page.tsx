"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function HelpPage() {
  return (
    <div>
      <Link href="/profile" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-border bg-surface">
          ‹
        </span>
        Профіль
      </Link>
      <div className="mb-4 pt-2 font-heading text-lg font-semibold text-text">Допомога</div>

      <Card className="mb-2.5">
        <div className="mb-1 text-[13px] font-semibold text-text">Про застосунок</div>
        <div className="text-[12px] leading-relaxed text-text-dim">
          «0.0 / Life OS» — персональний асистент для планування дня, фінансів і трейдингу.
          Усі дані зберігаються локально на цьому пристрої.
        </div>
      </Card>

      <Card className="mb-2.5">
        <div className="mb-1 text-[13px] font-semibold text-text">Дані та приватність</div>
        <div className="text-[12px] leading-relaxed text-text-dim">
          Керувати або видалити локальні дані можна в Профіль → Налаштування → Дані та
          приватність.
        </div>
      </Card>
    </div>
  );
}
