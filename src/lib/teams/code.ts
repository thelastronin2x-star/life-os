/** Pure helpers for team invite codes and avatar initials — kept out of the
 *  `server-only` db layer so they stay unit-testable. Codes exclude visually
 *  ambiguous characters (0/O, 1/I/L) since they're read aloud/typed by hand. */

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export function generateTeamCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeTeamCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function teamAvatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
