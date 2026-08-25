"use client";

import { useEffect, useRef, useState } from "react";

const QUICK_AMOUNTS = [100, 150, 300, 750, 1000]; // deliberately not 250/500 — those already have their own buttons
const MAX_ML = 5000; // guards against a stray extra digit or a bad paste, not a real physiological limit

interface CustomWaterAmountSheetProps {
  onClose: () => void;
  onConfirm: (ml: number) => void;
}

/** One shared component for both the dashboard widget card and the Water
 *  detail screen — same sheet, same onConfirm → store.addWater(ml) call the
 *  +250/+500 buttons already use, just with a typed-in number instead of a
 *  fixed one. Same bottom-sheet chrome already used everywhere else in the
 *  app (GoalForm.tsx, CategoryPickerSheet.tsx, etc.) rather than the
 *  prompt's bespoke .sheet/.sheet-handle markup. */
export function CustomWaterAmountSheet({ onClose, onConfirm }: CustomWaterAmountSheetProps) {
  const [amount, setAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Delayed to land after the sheet's own enter transition, same as the
    // prompt specifies — focusing instantly can fire before the sheet has
    // finished animating in on some browsers, popping the keyboard up over
    // a still-moving sheet.
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const ml = parseInt(amount, 10);
  const valid = Number.isFinite(ml) && ml > 0 && ml <= MAX_ML;

  function handleConfirm() {
    if (!valid) return;
    onConfirm(ml);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Свій обсяг</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <div className="flex items-baseline justify-center gap-2 py-5">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            className="w-[140px] bg-transparent text-right font-display text-[44px] font-extrabold text-text outline-none placeholder:text-text-faint"
          />
          <span className="text-[16px] font-bold text-text-faint">мл</span>
        </div>

        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {QUICK_AMOUNTS.map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="rounded-full bg-surface-2 px-3.5 py-2 text-[12.5px] font-bold"
              style={{ color: "var(--health-water)" }}
            >
              {v}
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!valid}
          className="w-full rounded-btn bg-text py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          {amount ? `Додати ${amount} мл` : "Додати"}
        </button>
      </div>
    </div>
  );
}
