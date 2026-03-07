import { NextRequest, NextResponse } from 'next/server';

async function getAccessToken(req: NextRequest): Promise<string | null> {
  return req.cookies.get('google_access_token')?.value || null;
}

// POST: Create a calendar event
export async function POST(req: NextRequest) {
  const token = await getAccessToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated with Google Calendar' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, startTime, endTime, roomLink, roomName } = body;

    const event = {
      summary: title,
      description: `Virtual Office Meeting in ${roomName}\n\nJoin: ${roomLink}`,
      start: {
        dateTime: startTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      conferenceData: undefined,
      location: roomLink,
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || 'Failed to create event' }, { status: res.status });
    }

    const created = await res.json();
    return NextResponse.json({ id: created.id, htmlLink: created.htmlLink });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
  }
}

// GET: List upcoming events
export async function GET(req: NextRequest) {
  const token = await getAccessToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(now)}&maxResults=20&singleEvents=true&orderBy=startTime`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ events: data.items || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
