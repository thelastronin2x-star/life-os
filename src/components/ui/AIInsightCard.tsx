import { SparkleIcon } from "@/components/icons";

/** Shared shape for every domain's rule-based (not per-render LLM) insight
 *  list — Здоров'я and Фінанси both compute their own Insight[] from
 *  threshold-gated statistical checks over that domain's own data. */
export interface Insight {
  id: string;
  text: string;
  color: string; // CSS var reference, e.g. "var(--sky)"
  sources: string[];
}

/** The same breathing sparkle badge already used for the assistant FAB and
 *  the Home insight card — not a new "AI feature" motif. A plain card, not a
 *  promo banner: hairline border, theme surface, no gradient. Originally
 *  Здоров'я-only (HealthAICard); generalized once Фінанси needed the exact
 *  same structure, so there's one component instead of two near-identical
 *  copies drifting apart. */
export function AIInsightCard({ insights, emptyText }: { insights: Insight[]; emptyText?: string }) {
  return (
    <div className="card-raised mb-3.5 rounded-card bg-surface p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <div className="well-pressed flex h-7 w-7 items-center justify-center rounded-icon bg-surface-2 text-text">
          <SparkleIcon className="assistant-fab-icon h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-[12.5px] font-semibold text-text">Асистент помітив</div>
        </div>
        <div className="text-[9.5px] text-text-faint">Щойно</div>
      </div>

      {insights.length === 0 ? (
        <div className="text-[12px] leading-relaxed text-text-dim">
          {emptyText ??
            "Асистент ще збирає дані для інсайтів — веди трек кілька днів, і тут з'являться зв'язки між показниками."}
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((i) => (
            <div key={i.id} className="flex items-start gap-2">
              <span className="mt-[5px] h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ background: i.color }} />
              <div>
                <p className="text-[12.5px] leading-snug text-text">{i.text}</p>
                <div className="mt-0.5 text-[9.5px] text-text-faint">{i.sources.join(" + ")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
