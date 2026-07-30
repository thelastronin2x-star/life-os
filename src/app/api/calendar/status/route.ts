import { NextResponse } from "next/server";
import { getValidSession } from "@/lib/google-calendar";

export async function GET() {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({ connected: true, email: session.email ?? null });
}
