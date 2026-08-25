import { NextRequest, NextResponse } from "next/server";
import { refreshMacroEvents } from "@/lib/macro/refresh";

/** Vercel Cron (daily, see vercel.json) — same Bearer-CRON_SECRET pattern
 *  as /api/news/refresh and /api/cron/reconcile-balances. Macro calendars
 *  change slowly (new dates get added days/weeks ahead), so a daily
 *  refresh is enough — unlike news, there's no case for hourly polling
 *  here, which also means no QStash workaround is needed for the Vercel
 *  Hobby plan's once-a-day cron limit. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await refreshMacroEvents();
  return NextResponse.json(result);
}
