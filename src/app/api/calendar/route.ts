import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3333/api/calendar';

// GET: handle OAuth callback or initiate auth
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (!code) {
    // Initiate OAuth flow
    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Google Calendar not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.' },
        { status: 501 }
      );
    }

    const scopes = 'https://www.googleapis.com/auth/calendar.events';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&access_type=offline` +
      `&prompt=consent`;

    return NextResponse.redirect(authUrl);
  }

  // Exchange code for tokens
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      return NextResponse.json({ error: tokens.error_description || tokens.error }, { status: 400 });
    }

    // Store tokens in a cookie (simplified; production should use secure storage)
    const response = NextResponse.redirect(new URL('/office?calendar=connected', req.url));
    response.cookies.set('google_access_token', tokens.access_token, {
      httpOnly: true,
      maxAge: tokens.expires_in || 3600,
      path: '/',
    });
    if (tokens.refresh_token) {
      response.cookies.set('google_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Failed to exchange OAuth code' }, { status: 500 });
  }
}
