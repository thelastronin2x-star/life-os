// Ported from the approved adaptive_animations.html prototype — same
// keyframes and timings, just returning markup for a React-managed overlay
// instead of vanilla-JS DOM writes.
export type AnimationBuilder = (c: string, c2: string, motifSvg: string) => string;

export const ANIMATION_NAMES = [
  "Signal Burst",
  "Assembly Grid",
  "Data Stream",
  "Orbit Ring",
  "Wave Reveal",
] as const;

export const STRONG_BUILDERS: AnimationBuilder[] = [
  // 0 Signal Burst
  (c, _c2, motif) => `
    <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; width:20px; height:20px; border-radius:50%; border:1.5px solid ${c}; animation:launchBurstRing 1s cubic-bezier(.2,.8,.3,1) forwards;"></div>
      <div style="position:absolute; width:20px; height:20px; border-radius:50%; border:1.5px solid ${c}; animation:launchBurstRing 1s cubic-bezier(.2,.8,.3,1) .15s forwards;"></div>
      <div style="opacity:0; animation:launchMotifIn .6s ease forwards;">${motif}</div>
    </div>
    <style>@keyframes launchBurstRing{ 0%{width:20px;height:20px;opacity:0.9;} 100%{width:280px;height:280px;opacity:0;} }</style>`,

  // 1 Assembly Grid
  (c, c2, motif) => {
    let tiles = "";
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const startX = (col - 1) * 140;
      const startY = (row - 1) * 140;
      tiles += `<div style="position:absolute; width:14px; height:14px; border-radius:4px; background:${
        col === 1 && row === 1 ? c : c2
      }; opacity:0.7; transform:translate(${startX}px,${startY}px); animation:launchTileIn${i} .7s cubic-bezier(.2,.7,.3,1) ${i * 0.03}s forwards;"></div>
      <style>@keyframes launchTileIn${i}{ to{ transform:translate(${(col - 1) * 20}px,${(row - 1) * 20}px); opacity:0; } }</style>`;
    }
    return `<div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
      ${tiles}
      <div style="opacity:0; animation:launchMotifIn .6s ease forwards;">${motif}</div>
    </div>`;
  },

  // 2 Data Stream
  (c, _c2, motif) => `
    <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;">
      <svg width="280" height="4" style="position:absolute;"><rect x="0" y="0" width="280" height="2" fill="${c}" opacity="0.5" style="animation:launchStreamMove .9s ease-in-out forwards;"/></svg>
      <div style="opacity:0; animation:launchMotifIn .6s ease forwards;">${motif}</div>
    </div>
    <style>@keyframes launchStreamMove{ 0%{transform:translateX(-280px);} 100%{transform:translateX(280px);} }</style>`,

  // 3 Orbit Ring
  (c, c2, motif) => `
    <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; width:9px; height:9px; border-radius:50%; background:${c}; animation:launchOrbitA .9s cubic-bezier(.3,.6,.3,1) forwards;"></div>
      <div style="position:absolute; width:9px; height:9px; border-radius:50%; background:${c2}; animation:launchOrbitB .9s cubic-bezier(.3,.6,.3,1) forwards;"></div>
      <div style="opacity:0; animation:launchMotifIn .6s ease forwards .3s;">${motif}</div>
    </div>
    <style>
      @keyframes launchOrbitA{ 0%{transform:rotate(0deg) translateX(50px);} 80%,100%{transform:rotate(360deg) translateX(0px);} }
      @keyframes launchOrbitB{ 0%{transform:rotate(180deg) translateX(50px);} 80%,100%{transform:rotate(540deg) translateX(0px);} }
    </style>`,

  // 4 Wave Reveal
  (c, _c2, motif) => `
    <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;">
      <div style="position:absolute; inset:0; background:radial-gradient(circle, color-mix(in srgb, ${c} 33%, transparent), transparent 60%); opacity:0; animation:launchWaveGlow .9s ease-in-out forwards;"></div>
      <div style="opacity:0; animation:launchMotifIn .6s ease forwards;">${motif}</div>
    </div>
    <style>@keyframes launchWaveGlow{ 0%{opacity:0; transform:scale(0.3);} 50%{opacity:1;} 100%{opacity:0; transform:scale(2.2);} }</style>`,
];
