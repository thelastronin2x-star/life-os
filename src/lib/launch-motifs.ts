import type { Profile } from "./store";

type MotifBuilder = (c: string, c2: string) => string;

// Add an entry here whenever a new profession ships its own launch motif.
export const LAUNCH_MOTIFS: Record<Profile, MotifBuilder> = {
  trader: (c) => `<svg width="70" height="50" viewBox="0 0 70 50">
    <rect x="4" y="24" width="6" height="18" fill="${c}" opacity="0.5"/>
    <rect x="16" y="14" width="6" height="28" fill="${c}" opacity="0.7"/>
    <rect x="28" y="6" width="6" height="36" fill="${c}"/>
    <rect x="40" y="18" width="6" height="24" fill="${c}" opacity="0.7"/>
    <rect x="52" y="0" width="6" height="42" fill="${c}" opacity="0.9"/>
  </svg>`,
  it: (c) => `<svg width="70" height="40" viewBox="0 0 70 40">
    <path d="M20 4 L4 20 L20 36" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M50 4 L66 20 L50 36" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 2 L30 38" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>
  </svg>`,
};
