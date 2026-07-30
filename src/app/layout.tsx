import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeSync } from "@/components/ThemeSync";
import { LaunchAnimation } from "@/components/LaunchAnimation";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { MonobankBackgroundSync } from "@/components/MonobankBackgroundSync";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

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
  themeColor: "#0E1210",
};

const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('life-os-store');if(raw){var d=JSON.parse(raw).state;if(d){document.documentElement.setAttribute('data-theme',d.theme||'deep-forest');document.documentElement.setAttribute('data-profile',d.profile||'trader');}}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      data-theme="deep-forest"
      data-profile="trader"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
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
