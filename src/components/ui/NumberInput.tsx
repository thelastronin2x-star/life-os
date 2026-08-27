"use client";

import { useEffect, useRef, useState } from "react";
import { parseDecimalInput } from "@/lib/parse-decimal-input";
import { cn } from "@/lib/cn";

interface NumberInputProps {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}

/**
 * A free-typing numeric input. Unlike a plain <input type="number"> bound
 * directly to a number via `Number(e.target.value) || 0`, this doesn't
 * force the field to "0" while the user is mid-edit (e.g. clearing the
 * field to retype, or typing "1," before the decimal digits).
 *
 * Accepts EITHER a comma or a period as the decimal separator — Ukrainian
 * keyboard layouts produce a comma on the numeric-decimal key. This used to
 * only allow a period, silently swallowing the comma keystroke entirely; a
 * user typing "1,0842" digit-by-digit would end up with "10842" once the
 * remaining digits landed with no separator between them at all — a wrong
 * price feeding straight into R:R/P&L math with no warning. See
 * parseDecimalInput for the shared normalization used both here and on blur.
 *
 * An unparseable value on blur (a lone "-", or anything that still isn't a
 * real number) is flagged with a visible error instead of being silently
 * reset to 0 — the user's actual keystrokes stay on screen so they can see
 * and fix the mistake, rather than the field quietly reverting behind their
 * back. A genuinely empty field still resets to 0, since that's a
 * deliberate "clear it" action, not a typo.
 *
 * Still reflects external changes (sliders, preset buttons) — it just
 * skips re-syncing from `value` while the field itself has focus, so it
 * doesn't fight the user's own keystrokes.
 */
export function NumberInput({ value, onChange, className, placeholder, style }: NumberInputProps) {
  const [text, setText] = useState(() => String(value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  function handleChange(raw: string) {
    if (!/^-?\d*[.,]?\d*$/.test(raw)) return;
    setText(raw);
    setInvalid(false);
    if (raw.endsWith(".") || raw.endsWith(",")) return; // mid-typing a decimal, not yet a complete number
    const n = parseDecimalInput(raw);
    if (n !== null) onChange(n);
  }

  function handleBlur() {
    focused.current = false;
    if (text.trim() === "") {
      setInvalid(false);
      setText("0");
      onChange(0);
      return;
    }
    const n = parseDecimalInput(text);
    if (n === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(String(n));
    onChange(n);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className={cn(className, invalid && "border-rose text-rose")}
      style={style}
    />
  );
}
