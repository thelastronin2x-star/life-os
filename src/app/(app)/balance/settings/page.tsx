"use client";

import Link from "next/link";
import { WalletIcon, BankIcon, DocumentIcon, HistoryIcon, BarChartIcon } from "@/components/icons";

function MenuRow({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link href={href} className="flex w-full items-center gap-3.5 border-b border-border py-3.5 text-left last:border-b-0">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-icon bg-surface text-text-dim">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-text">{title}</span>
        <span className="mt-0.5 block text-[10.5px] text-text-faint">{sub}</span>
      </span>
      <span className="text-text-faint">›</span>
    </Link>
  );
}

/** The gear icon's destination — was a direct link to /balance/monobank;
 *  now that Огляд no longer shows the account carousel, account management
 *  needs its own entry point too, so this became a small menu instead of a
 *  single-purpose link. */
export default function FinanceSettingsPage() {
  return (
    <div>
      <Link href="/balance" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
          ‹
        </span>
        Фінанси
      </Link>
      <div className="mb-4 pt-2 font-heading text-lg font-semibold text-text">Налаштування</div>

      <div>
        <MenuRow
          href="/balance/accounts"
          icon={<WalletIcon className="h-4 w-4" />}
          title="Рахунки"
          sub="Додати, редагувати, обрати активний"
        />
        <MenuRow
          href="/balance/monobank"
          icon={<BankIcon className="h-4 w-4" />}
          title="Monobank"
          sub="Підключення й синхронізація виписки"
        />
        <MenuRow
          href="/balance/manual-data"
          icon={<DocumentIcon className="h-4 w-4" />}
          title="Борги, інвестиції та страхування"
          sub="Ручні дані для показників фінансового здоров'я"
        />
        <MenuRow
          href="/balance/transactions"
          icon={<HistoryIcon className="h-4 w-4" />}
          title="Всі транзакції"
          sub="Повна стрічка й ручне редагування"
        />
        <MenuRow
          href="/balance/reports"
          icon={<BarChartIcon className="h-4 w-4" />}
          title="Детальна аналітика"
          sub="Тренди, категорії, регулярні платежі"
        />
      </div>
    </div>
  );
}
