/** Returns an error message if the goal's numbers can't be saved, or null if
 *  they're fine. A target of 0 (or negative) turns GoalRing's
 *  contributed/target math into NaN/Infinity — rejected here with a visible
 *  reason instead of a silent no-op on submit. */
export function validateGoal(target: number, contributed: number): string | null {
  if (target <= 0) return "Ціль має бути більшою за нуль";
  if (contributed < 0) return "Накопичена сума не може бути від'ємною";
  return null;
}
