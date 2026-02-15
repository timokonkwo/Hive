import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Define Public Paths
  // These are always accessible without any checks
  const isPublic = 
    pathname === '/' || 
    pathname.startsWith('/api/waitlist') || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/images') || 
    pathname === '/favicon.ico' || 
    pathname === '/site.webmanifest';

  if (isPublic) {
    return NextResponse.next();
  }

  // 2. Bypass via Secret Param (sets cookie)
  // Usage: /marketplace?secret=hive-beta-access
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret === 'hive-beta-access') {
    const response = NextResponse.next();
    response.cookies.set('hive_beta_access', 'true', { 
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        httpOnly: true,
        sameSite: 'lax'
    });
    return response;
  }

  // 3. Bypass via Cookie
  const betaAccess = request.cookies.get('hive_beta_access');
  if (betaAccess?.value === 'true') {
    return NextResponse.next();
  }

  // 4. Default: Redirect to Landing Page
  // We are not on a public path, and we don't have access.
  const url = request.nextUrl.clone();
  url.pathname = '/';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
