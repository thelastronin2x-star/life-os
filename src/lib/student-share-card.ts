import type { WeeklyRecap } from "./student-insights";

const WIDTH = 640;
const HEIGHT = 420;

/** Draws the weekly recap onto an offscreen canvas and resolves a PNG blob —
 *  the "справжня функція" the prompt asked for behind "Поділитися →" rather
 *  than a decorative button that does nothing. Pure rendering, no DOM
 *  attachment; the caller (StudentWork.tsx) decides how to hand the blob
 *  off (Web Share API with a File, or a plain download link). */
export function renderWeeklyShareCard(recap: WeeklyRecap): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#241f1a");
  gradient.addColorStop(1, "#151210");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#8a8378";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText("ТИЖДЕНЬ ПІДСУМОК", 40, 60);

  ctx.fillStyle = "#e8e4dc";
  ctx.font = "800 30px system-ui, sans-serif";
  ctx.fillText("Мій навчальний тиждень", 40, 105);

  const metrics: { label: string; value: string; color: string }[] = [
    { label: "навчання", value: `${Math.round(recap.minutes / 60)} год`, color: "#e8e4dc" },
    { label: "XP", value: `+${recap.xp}`, color: "#c9a45f" },
    { label: "карток", value: String(recap.cards), color: "#8fa583" },
  ];

  const colWidth = (WIDTH - 80) / 3;
  metrics.forEach((m, i) => {
    const x = 40 + i * colWidth;
    ctx.fillStyle = m.color;
    ctx.font = "800 42px system-ui, sans-serif";
    ctx.fillText(m.value, x, 220);
    ctx.fillStyle = "#6b6459";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText(m.label, x, 250);
  });

  ctx.strokeStyle = "#3a342d";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, HEIGHT - 60);
  ctx.lineTo(WIDTH - 40, HEIGHT - 60);
  ctx.stroke();

  ctx.fillStyle = "#6b6459";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("Life OS · Студент", 40, HEIGHT - 30);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

/** Native share sheet when available (mobile PWA); otherwise a plain
 *  download — both are a genuine artifact the user gets to keep, matching
 *  what the mockup's "Поділитися" button promises. */
export async function shareWeeklyCard(recap: WeeklyRecap): Promise<void> {
  const blob = await renderWeeklyShareCard(recap);
  if (!blob) return;
  const file = new File([blob], "week-recap.png", { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Мій навчальний тиждень" });
      return;
    } catch {
      // User cancelled the share sheet, or the platform rejected it — fall
      // through to a plain download rather than leaving the tap with no
      // visible result.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "week-recap.png";
  a.click();
  URL.revokeObjectURL(url);
}
