import { NextResponse } from "next/server";
import { fetchNbuRates } from "@/lib/nbu-rates";

export async function GET() {
  try {
    const rates = await fetchNbuRates();
    return NextResponse.json({ rates });
  } catch (e) {
    console.error("NBU rates fetch failed", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
