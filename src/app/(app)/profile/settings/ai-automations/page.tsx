"use client";

import Link from "next/link";
import { useState } from "react";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useAutomationsStore, type AutomationId } from "@/lib/automations-store";
import {
  BellIcon,
  ClockIcon,
  CalendarDateIcon,
  RefreshIcon,
  HistoryIcon,
  BarChartIcon,
  TargetIcon,
  DocumentIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

interface Row {
  id: AutomationId | null;
  icon: typeof BellIcon;
  name: string;
  description: string;
}

const PROACTIVE_ROWS: Row[] = [
  {
    id: "instant-warnings",
    icon: BellIcon,
    name: "Пуш в моменті",
    description: "Попереджає одразу, якщо бачить ознаки помітливого трейдингу зараз",
  },
  {
    id: null,
    icon: ClockIcon,
    name: "Нічний автоаудит",
    description: "Синхронізує дані, оновлює аналітику — незабаром",
  },
  {
    id: "calendar-blocker",
    icon: CalendarDateIcon,
    name: "Розумний блокер календаря",
    description: "Сам ставить «заборонені зони» під важливі новини й після збиткової сесії",
  },
  {
    id: "advice-follow-up",
    icon: RefreshIcon,
    name: "Автоперевірка своїх порад",
    description: "Через тиждень звіряє реальні до/після цифри й записує, чи спрацювала рекомендація",
  },
];

const AUTOFILL_ROWS: Row[] = [
  {
    id: "retro-tagging",
    icon: HistoryIcon,
    name: "Автотегування заднім числом",
    description: "Доповнює пропущені теги й сесію за схожими минулими угодами того самого інструмента",
  },
  {
    id: null,
    icon: BarChartIcon,
    name: "Самонавчальні пороги",
    description: "Межі попереджень підлаштовуються під твою власну статистику з часом — незабаром",
  },
];

const EXECUTION_ROWS: Row[] = [
  {
    id: null,
    icon: TargetIcon,
    name: "Дрібні задачі без підтвердження",
    description: "Прості дії (нагадування) виконує сам, без наслідків — незабаром",
  },
  {
    id: null,
    icon: DocumentIcon,
    name: "Автозвіти",
    description: "Готує чернетки тижневих/місячних звітів заздалегідь — незабаром",
  },
];

function AutomationRow({ row }: { row: Row }) {
  const enabled = useAutomationsStore((s) => (row.id ? s.enabled[row.id] : false));
  const toggleAutomation = useAutomationsStore((s) => s.toggleAutomation);
  const Icon = row.icon;
  const isReal = row.id !== null;

  return (
    <div className={cn("card-raised mb-2.5 flex items-center gap-3 rounded-card bg-surface p-3.5", !isReal && "opacity-60")}>
      <span className="well-pressed flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-sage">
        <Icon className="h-[15px] w-[15px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-text">{row.name}</div>
        <div className="mt-0.5 text-[10.5px] leading-[1.3] text-text-faint">{row.description}</div>
      </div>
      {isReal ? (
        <ToggleSwitch on={!!enabled} onToggle={() => toggleAutomation(row.id!)} />
      ) : (
        <span className="flex-shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-text-faint">
          Незабаром
        </span>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 mt-[18px] text-[11px] font-bold uppercase tracking-wide text-text-faint first:mt-0">{children}</div>;
}

export default function AiAutomationsPage() {
  const customRules = useAutomationsStore((s) => s.customRules);
  const addCustomRule = useAutomationsStore((s) => s.addCustomRule);
  const removeCustomRule = useAutomationsStore((s) => s.removeCustomRule);
  const [addingRule, setAddingRule] = useState(false);
  const [ruleText, setRuleText] = useState("");

  function handleAddRule() {
    if (!ruleText.trim()) return;
    addCustomRule(ruleText.trim());
    setRuleText("");
    setAddingRule(false);
  }

  return (
    <div>
      <Link href="/profile/settings" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">‹</span>
        Налаштування
      </Link>
      <div className="mb-1 pt-2 font-heading text-lg font-semibold text-text">AI-автоматизація</div>
      <div className="mb-4 text-[11.5px] text-text-faint">Що застосунок робить сам, без запиту</div>

      <SectionLabel>Проактивні дії</SectionLabel>
      {PROACTIVE_ROWS.map((row) => (
        <AutomationRow key={row.name} row={row} />
      ))}

      <SectionLabel>Автозаповнення</SectionLabel>
      {AUTOFILL_ROWS.map((row) => (
        <AutomationRow key={row.name} row={row} />
      ))}

      <SectionLabel>Виконання дій</SectionLabel>
      {EXECUTION_ROWS.map((row) => (
        <AutomationRow key={row.name} row={row} />
      ))}

      <SectionLabel>Свої правила</SectionLabel>
      <div className="mb-2.5 text-[11px] leading-relaxed text-text-faint">
        Умова природною мовою — збережеться, але виконання поки не активне.
      </div>
      {customRules.map((rule) => (
        <div key={rule.id} className="card-raised mb-2 flex items-center gap-3 rounded-card bg-surface p-3.5">
          <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-text-dim">&quot;{rule.text}&quot;</div>
          <button onClick={() => removeCustomRule(rule.id)} aria-label="Видалити правило" className="flex-shrink-0 text-text-faint">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}

      {addingRule ? (
        <div className="card-raised mb-2.5 rounded-card bg-surface p-3.5">
          <textarea
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            placeholder="Наприклад: якщо сплю менше 6 год — зменш ліміт ризику на день"
            rows={2}
            autoFocus
            className="mb-2.5 w-full resize-none rounded-input border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-text outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAddingRule(false);
                setRuleText("");
              }}
              className="flex-1 rounded-btn bg-surface-2 py-2.5 text-center text-[12px] font-semibold text-text-dim"
            >
              Скасувати
            </button>
            <button onClick={handleAddRule} className="flex-1 rounded-btn bg-sage py-2.5 text-center text-[12px] font-bold text-bg">
              Зберегти
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingRule(true)}
          className="well-pressed mb-4 flex w-full items-center justify-center gap-2 rounded-card bg-surface py-3.5 text-[12.5px] font-bold text-sage"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Додати своє правило
        </button>
      )}
    </div>
  );
}
