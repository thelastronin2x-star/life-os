import { NextRequest, NextResponse } from "next/server";
import { refreshNews } from "@/lib/news/refresh";

/** Vercel Cron (hourly, see vercel.json) — same Bearer-CRON_SECRET pattern
 *  as /api/cron/reconcile-balances. This is the ONLY thing that ever calls
 *  Alpha Vantage; the read endpoint (/api/news) only ever touches the
 *  Postgres cache this route fills, so opening the Робота tab never
 *  triggers an external API call. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await refreshNews();
  return NextResponse.json(result);
}
