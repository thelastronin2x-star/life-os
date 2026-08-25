import { cn } from "@/lib/cn";

interface ToggleSwitchProps {
  on: boolean;
  onToggle: () => void;
  accentColor?: string; // CSS color, defaults to the theme's accent
}

/** Sliding pill switch — first use in the app, previously every settings
 *  row used a picker sheet or a status pill instead. Reserved for genuine
 *  on/off preferences like "Відстежувати цикл" rather than replacing those
 *  patterns elsewhere. */
export function ToggleSwitch({ on, onToggle, accentColor }: ToggleSwitchProps) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={cn("relative h-[26px] w-[44px] flex-shrink-0 rounded-full transition-colors", !on && "bg-surface-2")}
      style={on ? { background: accentColor ?? "var(--accent)" } : undefined}
    >
      <span
        className={cn(
          "absolute top-[3px] h-5 w-5 rounded-full bg-bg shadow transition-[left]",
          on ? "left-[21px]" : "left-[3px]"
        )}
      />
    </button>
  );
}
