import { dayFractionOf, skyBandFor, sunTrailFor } from "./launch-sky";

// Ported from the approved adaptive_animations.html prototype — same
// keyframes and timings, just returning markup for a React-managed overlay
// instead of vanilla-JS DOM writes.
export type AnimationBuilder = (c: string, c2: string, motifSvg: string) => string;

/** The time-of-day launch screen: a sky that shifts from dawn to night, with
 *  the sun tracking a half-circle arc across the real 24-hour clock.
 *
 *  Reads the clock at the moment it's called, so it's genuinely different at
 *  every open with no state to keep and nothing to invalidate. Deliberately
 *  does NOT use the app's own theme tokens — the sky IS the background here,
 *  and inheriting --bg would flatten the whole effect at exactly the hours
 *  when it's most distinct.
 *
 *  The profile motif still rides along, so a trader keeps their candles and
 *  IT keeps their brackets. */
export function buildSkyLaunch(motifSvg: string, now: Date = new Date()): string {
  const sky = skyBandFor(now);
  const trail = sunTrailFor(now);

  // Sampled keyframes rather than CSS `offset-path`: the arc lives in an SVG
  // viewBox stretched to the viewport, so a CSS motion path (raw pixels) would
  // drift off the dashed line on every screen size but one.
  //
  // Positioned with `transform: translate(vw, vh)`, NOT with left/top. Animating
  // left/top makes the browser redo layout on every single frame, which is what
  // the stutter was — transform is composited on the GPU and never touches
  // layout. vw/vh work here because the launch layer is fixed inset-0, so the
  // viewport and the element's box are the same thing.
  const steps = trail
    .map((p, i) => {
      const pct = ((i / (trail.length - 1)) * 100).toFixed(2);
      // Fades in over the first third of the travel, so the disc appears to
      // rise into view rather than pop in already moving.
      const opacity = Math.min(1, (i / (trail.length - 1)) * 3).toFixed(2);
      const x = `calc(${(p.x * 100).toFixed(2)}vw - 50%)`;
      const y = `calc(${(p.y * 100).toFixed(2)}vh - 50%)`;
      return `${pct}%{ transform:translate3d(${x}, ${y}, 0); opacity:${opacity}; }`;
    })
    .join(" ");

  // How much of the arc the day has already covered. Drawn as a solid trail
  // over the dashed track, so the line stops being decoration and starts
  // saying something: at a glance you can see how far into the day it is.
  const travelled = (dayFractionOf(now) * 100).toFixed(1);

  return `
    <div style="position:absolute; inset:0; background:${sky.background}; color:${sky.text}; overflow:hidden;">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%;">
        <!-- The full path of the sun, dashed and faint. Previously 0.4px at
             28% opacity, which on a phone read as "is there a line?" -->
        <path d="M7 86 Q50 10 93 86" fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-dasharray="5 7" stroke-linecap="round" opacity="0.4" vector-effect="non-scaling-stroke"/>
        <!-- pathLength=100 normalises the curve so the dash maths is a plain
             percentage instead of depending on the rendered size. -->
        <path d="M7 86 Q50 10 93 86" fill="none" stroke="${sky.disc}" stroke-width="2.6"
              stroke-linecap="round" pathLength="100" stroke-dasharray="100"
              stroke-dashoffset="100" opacity="0.85" vector-effect="non-scaling-stroke"
              style="animation:launchArcDraw 1.5s cubic-bezier(.33,.06,.28,1) forwards;"/>
      </svg>
      <div class="launch-sun" style="position:absolute; top:0; left:0; width:38px; height:38px; border-radius:50%; background:${sky.disc}; box-shadow:0 0 40px ${sky.disc}; opacity:0; will-change:transform, opacity; animation:launchSunTravel 1.5s linear forwards;"></div>
      <div style="position:absolute; left:0; right:0; bottom:16%; display:flex; flex-direction:column; align-items:center; gap:14px;">
        <div style="opacity:0; animation:launchMotifIn .6s ease .55s forwards;">${motifSvg}</div>
        <div style="opacity:0; animation:launchSkyTextIn .5s ease .8s forwards; font-size:22px; font-weight:800; letter-spacing:-.025em;">${sky.greeting}</div>
      </div>
    </div>
    <style>
      /* Linear, deliberately. A timing function applies BETWEEN each pair of
         keyframes, not across the animation as a whole — so an ease curve over
         15 sampled points becomes 15 little accelerations in a row, which is
         read as stutter rather than as easing. The arc's own shape already
         provides the visual slowing near the top. */
      @keyframes launchSunTravel{ ${steps} }
      /* Ends exactly where the disc lands, so the bright trail reads as the
         path the sun has already walked today rather than a separate stroke
         that happens to be nearby. */
      @keyframes launchArcDraw{ to{ stroke-dashoffset:${100 - Number(travelled)}; } }
      @keyframes launchSkyTextIn{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
      /* A disc gliding across the screen for a second and a half is exactly
         the kind of motion this preference exists to suppress. Collapsing the
         duration keeps the final, correct position without the journey. */
      @media (prefers-reduced-motion: reduce){
        .launch-sun{ animation-duration:.01ms !important; }
        path[style*="launchArcDraw"]{ animation-duration:.01ms !important; }
      }
    </style>`;
}

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
