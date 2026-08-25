import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "0.0 / Life OS",
    short_name: "Life OS",
    description: "Персональний асистент для планування дня, фінансів і трейдингу",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f1e6",
    theme_color: "#f6f1e6",
    lang: "uk",
    icons: [
      { src: "/manifest-icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/manifest-icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/manifest-icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
