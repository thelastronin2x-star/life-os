import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // Inlined at build time so the running app can state exactly which commit
  // it was built from. Without this there's no way to tell a deploy that
  // didn't land from a change that didn't do anything — the two look
  // identical from the phone, and that ambiguity has already cost real
  // debugging time. Vercel provides these automatically; locally they're
  // undefined and the UI falls back to "локальна збірка".
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
