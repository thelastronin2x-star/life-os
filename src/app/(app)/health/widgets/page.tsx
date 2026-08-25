"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { HEALTH_WIDGET_IDS, HEALTH_WIDGET_CONFIG } from "@/lib/health-widget-config";

export default function HealthWidgetSettingsPage() {
  const enabledHealthWidgets = useAppStore((s) => s.settings.enabledHealthWidgets);
  const toggleHealthWidget = useAppStore((s) => s.toggleHealthWidget);

  return (
    <div>
      <Link href="/health" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
          ‹
        </span>
        Здоров&apos;я
      </Link>
      <div className="mb-4 pt-2 font-heading text-lg font-semibold text-text">Віджети Здоров&apos;я</div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
        Показувати на дашборді
      </div>
      <div className="space-y-2">
        {HEALTH_WIDGET_IDS.map((id) => (
          <div
            key={id}
            className="flex items-center justify-between rounded-card-sm border border-border bg-surface px-3.5 py-3"
          >
            <span className="text-[13.5px] font-medium text-text">{HEALTH_WIDGET_CONFIG[id].label}</span>
            <ToggleSwitch on={enabledHealthWidgets.includes(id)} onToggle={() => toggleHealthWidget(id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
