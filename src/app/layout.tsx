import type { Metadata, Viewport } from "next";
import { Onest, Unbounded, JetBrains_Mono } from "next/font/google";
import { ThemeSync } from "@/components/ThemeSync";
import { LaunchAnimation } from "@/components/LaunchAnimation";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { MonobankBackgroundSync } from "@/components/MonobankBackgroundSync";
import "./globals.css";

// Body and headings. Onest replaces Nunito: Nunito's rounded terminals read
// as friendly at 20px and as soft/imprecise at 11.5px, which is the size most
// of this app's labels actually live at. Onest keeps the warmth but holds its
// shape small, and its Cyrillic is drawn rather than derived.
// No `weight`: both faces are variable on Google Fonts, so the whole axis
// ships in one file and every weight the UI asks for is available. Pinning a
// list here would download several static cuts instead, and fail the build
// outright for any weight that has no static instance.
const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
});

// Display face, used only for the handful of figures a screen is built
// around. It is deliberately not the number font everywhere: Unbounded has no
// tabular figures, so a column of amounts in it would visibly jitter.
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
});

// Still the face for genuinely tabular numbers — tables, ledgers, any column
// of amounts that has to line up digit under digit.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "0.0 / Life OS",
  description: "Персональний AI-асистент життя",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Life OS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f1e6",
  // Without this the page stops at the safe area, so on a notch/Dynamic Island
  // phone the launch overlay — even at `fixed inset-0` — leaves a black band
  // across the top: the viewport itself never reached the physical edge.
  // Paired with the black-translucent status bar above, the app now paints the
  // full screen, and per-screen padding comes from env(safe-area-inset-*).
  viewportFit: "cover",
};

const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('life-os-store');if(raw){var d=JSON.parse(raw).state;if(d){document.documentElement.setAttribute('data-theme',d.theme||'soft-blocks');document.documentElement.setAttribute('data-profile',d.profile||'trader');}}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      data-theme="soft-blocks"
      data-profile="trader"
      suppressHydrationWarning
      className={`${onest.variable} ${unbounded.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg text-text font-sans antialiased">
        <ThemeSync />
        <LaunchAnimation />
        <ServiceWorkerRegister />
        <MonobankBackgroundSync />
        {children}
      </body>
    </html>
  );
}
