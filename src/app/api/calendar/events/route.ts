import { NextRequest, NextResponse } from "next/server";
import { getValidSession } from "@/lib/google-calendar";

interface GoogleEventItem {
  id: string;
  summary?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink?: string;
}

export async function GET() {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "fetch_failed", details: await res.text() }, { status: 502 });
  }

  const data: { items?: GoogleEventItem[] } = await res.json();
  const events: CalendarEvent[] = (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.summary ?? "(без назви)",
    start: (item.start?.dateTime ?? item.start?.date) as string,
    end: (item.end?.dateTime ?? item.end?.date) as string,
    allDay: !item.start?.dateTime,
    htmlLink: item.htmlLink,
  }));

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const body = (await request.json()) as { title?: string; start?: string; end?: string };
  const { title, start, end } = body;

  if (!title || !start || !end) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: title,
      start: { dateTime: start },
      end: { dateTime: end },
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "create_failed", details: await res.text() }, { status: 502 });
  }

  const created: GoogleEventItem = await res.json();
  return NextResponse.json({
    event: {
      id: created.id,
      title: created.summary ?? title,
      start: created.start?.dateTime ?? created.start?.date ?? start,
      end: created.end?.dateTime ?? created.end?.date ?? end,
      allDay: !created.start?.dateTime,
      htmlLink: created.htmlLink,
    } satisfies CalendarEvent,
  });
}
