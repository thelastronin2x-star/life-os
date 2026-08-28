"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFinanceStore, INSURANCE_TYPES, type InsuranceType, type Debt, type Investment } from "@/lib/finance-store";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { TrashIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const STEP_COUNT = 4;
const STEP_TITLES = ["Місячний чек-ін", "Борги", "Інвестиції", "Страхування"];

const INSURANCE_LABELS: Record<InsuranceType, string> = {
  life: "Життя",
  health: "Здоров'я",
  property: "Майно",
};

/** Same route for the first-run onboarding (redirected here automatically
 *  until manualDataOnboarded is set — see FinanceOverview) and later edits
 *  from Налаштування → «Борги, інвестиції та страхування». Every field
 *  writes straight to the store as it's typed (matching how AccountForm/
 *  BudgetCategoryForm already behave elsewhere), so there's no separate
 *  "draft" state to lose or discard — Back/Skip/Done are all just
 *  navigation, not save-or-cancel. */
// A row added via "+ Додати" and left completely untouched (e.g. the user
// tapped it by accident, or backed out without filling anything in) has no
// real information in it — pruned on every step change so it never lingers
// as a blank line in the dashboard's debt/investment lists.
function pruneEmptyEntries() {
  const { debts, investments, removeDebt, removeInvestment } = useFinanceStore.getState();
  for (const d of debts) {
    if (!d.name.trim() && d.remainingAmount === 0 && d.monthlyPayment === 0) removeDebt(d.id);
  }
  for (const i of investments) {
    if (!i.type.trim() && i.amount === 0) removeInvestment(i.id);
  }
}

export default function ManualFinancialDataPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [savings, setSavings] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  // Leaving step 1 always commits the check-in (even at default zeros —
  // it's a real snapshot either way), so the dashboard has at least one
  // point to compute from the moment onboarding finishes.
  function commitCheckInIfLeavingStep1() {
    if (step === 1) useFinanceStore.getState().upsertCheckIn({ savings, monthlyIncome, monthlyExpenses });
  }

  function goToStep(next: number) {
    commitCheckInIfLeavingStep1();
    pruneEmptyEntries();
    setStep(next);
  }

  function finish() {
    commitCheckInIfLeavingStep1();
    pruneEmptyEntries();
    useFinanceStore.getState().setManualDataOnboarded(true);
    router.push("/balance");
  }

  return (
    <div>
      <div className="flex gap-1.5 pt-2">
        {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((s) => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-accent" : "bg-surface-2")} />
        ))}
      </div>

      <div className="mb-5 mt-4 flex items-center gap-2">
        {step > 1 && (
          <button
            onClick={() => goToStep(step - 1)}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-icon border border-border bg-surface text-text-dim"
          >
            ‹
          </button>
        )}
        <div className="font-heading text-lg font-semibold text-text">{STEP_TITLES[step - 1]}</div>
      </div>

      {step === 1 && (
        <CheckInStep
          savings={savings}
          setSavings={setSavings}
          monthlyIncome={monthlyIncome}
          setMonthlyIncome={setMonthlyIncome}
          monthlyExpenses={monthlyExpenses}
          setMonthlyExpenses={setMonthlyExpenses}
        />
      )}
      {step === 2 && <DebtsStep onNoDebts={() => goToStep(3)} />}
      {step === 3 && <InvestmentsStep onNoInvestments={() => goToStep(4)} />}
      {step === 4 && <InsuranceStep />}

      <div className="mt-5 space-y-2.5">
        {step < STEP_COUNT ? (
          <button
            onClick={() => goToStep(step + 1)}
            className="w-full rounded-btn bg-accent py-3 text-center text-[13px] font-semibold text-bg"
          >
            Далі
          </button>
        ) : (
          <button onClick={finish} className="w-full rounded-btn bg-accent py-3 text-center text-[13px] font-semibold text-bg">
            Готово
          </button>
        )}
        {step > 1 && (
          <button onClick={finish} className="w-full text-center text-[12px] text-text-faint underline">
            Пропустити — заповню пізніше
          </button>
        )}
      </div>
    </div>
  );
}

function CheckInStep({
  savings,
  setSavings,
  monthlyIncome,
  setMonthlyIncome,
  monthlyExpenses,
  setMonthlyExpenses,
}: {
  savings: number;
  setSavings: (n: number) => void;
  monthlyIncome: number;
  setMonthlyIncome: (n: number) => void;
  monthlyExpenses: number;
  setMonthlyExpenses: (n: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="mb-1 text-[12.5px] leading-relaxed text-text-dim">
        Три числа — займе хвилину. Це основа для показників «Резервний фонд», «Норма заощаджень» і «Чистий капітал» нижче.
      </div>
      <label className="block">
        <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Поточні заощадження</span>
        <NumberInput
          value={savings}
          onChange={setSavings}
          className="w-full rounded-input border border-border bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-text outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Дохід за місяць</span>
        <NumberInput
          value={monthlyIncome}
          onChange={setMonthlyIncome}
          className="w-full rounded-input border border-border bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-text outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Витрати за місяць</span>
        <NumberInput
          value={monthlyExpenses}
          onChange={setMonthlyExpenses}
          className="w-full rounded-input border border-border bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-text outline-none"
        />
      </label>
    </div>
  );
}

function DebtsStep({ onNoDebts }: { onNoDebts: () => void }) {
  const debts = useFinanceStore((s) => s.debts);
  const { addDebt, updateDebt, removeDebt } = useFinanceStore();

  if (debts.length === 0) {
    return (
      <div>
        <div className="mb-3 text-[12.5px] leading-relaxed text-text-dim">Чи є в тебе борги — кредити, розстрочки?</div>
        <div className="flex gap-2">
          <button
            onClick={() => addDebt({ name: "", remainingAmount: 0, monthlyPayment: 0 })}
            className="flex-1 rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Так, є
          </button>
          <button
            onClick={onNoDebts}
            className="flex-1 rounded-btn border border-border bg-surface py-2.5 text-center text-[12.5px] font-semibold text-text-dim"
          >
            Немає
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {debts.map((d) => (
        <DebtRow key={d.id} debt={d} onChange={(patch) => updateDebt(d.id, patch)} onDelete={() => removeDebt(d.id)} />
      ))}
      <button
        onClick={() => addDebt({ name: "", remainingAmount: 0, monthlyPayment: 0 })}
        className="w-full rounded-btn border-[1.5px] border-dashed border-border py-2.5 text-center text-[11.5px] font-semibold text-text-faint"
      >
        + Додати ще борг
      </button>
    </div>
  );
}

function DebtRow({
  debt,
  onChange,
  onDelete,
}: {
  debt: Debt;
  onChange: (patch: Partial<Omit<Debt, "id">>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="card-raised rounded-card-sm bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="Назва (напр. Кредитка)"
          value={debt.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="min-w-0 flex-1 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-[12.5px] text-text outline-none"
        />
        <button onClick={onDelete} aria-label="Видалити борг" className="flex-shrink-0 text-text-faint">
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Залишок</span>
          <NumberInput
            value={debt.remainingAmount}
            onChange={(v) => onChange({ remainingAmount: v })}
            className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-[9.5px] uppercase text-text-faint">Платіж/міс</span>
          <NumberInput
            value={debt.monthlyPayment}
            onChange={(v) => onChange({ monthlyPayment: v })}
            className="w-full rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
          />
        </label>
      </div>
    </div>
  );
}

function InvestmentsStep({ onNoInvestments }: { onNoInvestments: () => void }) {
  const investments = useFinanceStore((s) => s.investments);
  const { addInvestment, updateInvestment, removeInvestment } = useFinanceStore();

  if (investments.length === 0) {
    return (
      <div>
        <div className="mb-3 text-[12.5px] leading-relaxed text-text-dim">
          Чи є в тебе інвестиції — акції, крипта, депозити?
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addInvestment({ type: "", amount: 0 })}
            className="flex-1 rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Так, є
          </button>
          <button
            onClick={onNoInvestments}
            className="flex-1 rounded-btn border border-border bg-surface py-2.5 text-center text-[12.5px] font-semibold text-text-dim"
          >
            Немає
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {investments.map((i) => (
        <InvestmentRow
          key={i.id}
          investment={i}
          onChange={(patch) => updateInvestment(i.id, patch)}
          onDelete={() => removeInvestment(i.id)}
        />
      ))}
      <button
        onClick={() => addInvestment({ type: "", amount: 0 })}
        className="w-full rounded-btn border-[1.5px] border-dashed border-border py-2.5 text-center text-[11.5px] font-semibold text-text-faint"
      >
        + Додати ще актив
      </button>
    </div>
  );
}

function InvestmentRow({
  investment,
  onChange,
  onDelete,
}: {
  investment: Investment;
  onChange: (patch: Partial<Omit<Investment, "id">>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="card-raised flex items-center gap-2 rounded-card-sm bg-surface p-3">
      <input
        type="text"
        placeholder="Тип (напр. Акції, ОВДП)"
        value={investment.type}
        onChange={(e) => onChange({ type: e.target.value })}
        className="min-w-0 flex-1 rounded-input border border-border bg-surface-2 px-2.5 py-2 text-[12.5px] text-text outline-none"
      />
      <NumberInput
        value={investment.amount}
        onChange={(v) => onChange({ amount: v })}
        className="w-24 flex-shrink-0 rounded-input border border-border bg-surface-2 px-2 py-2 font-mono text-[12px] text-text outline-none"
      />
      <button onClick={onDelete} aria-label="Видалити актив" className="flex-shrink-0 text-text-faint">
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function InsuranceStep() {
  const insurancePolicies = useFinanceStore((s) => s.insurancePolicies);
  const setInsurancePolicy = useFinanceStore((s) => s.setInsurancePolicy);

  return (
    <div className="space-y-2">
      {INSURANCE_TYPES.map((type) => {
        const policy = insurancePolicies.find((p) => p.type === type);
        return (
          <div
            key={type}
            className="card-raised flex items-center justify-between rounded-card-sm bg-surface px-3.5 py-3"
          >
            <span className="text-[13px] font-medium text-text">{INSURANCE_LABELS[type]}</span>
            <ToggleSwitch on={policy?.hasPolicy ?? false} onToggle={() => setInsurancePolicy(type, !(policy?.hasPolicy ?? false))} />
          </div>
        );
      })}
    </div>
  );
}
