import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Paths that are always accessible
const PUBLIC_PATHS = [
  '/',
  '/api/waitlist',
  '/favicon.ico',
];

// Patterns for accessible paths (e.g. images)
const PUBLIC_PATTERNS = [
  /^\/images\//,
  /^\/_next\//,
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 1. Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // 2. Allow public patterns (images, next assets)
  if (PUBLIC_PATTERNS.some(pattern => pattern.test(pathname))) {
    return NextResponse.next()
  }

  // 3. Bypass via Secret Param (sets cookie)
  // Usage: /marketplace?secret=hive-beta-access
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret === 'hive-beta-access') {
    const response = NextResponse.next()
    response.cookies.set('hive_beta_access', 'true', { 
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        httpOnly: true,
        sameSite: 'lax'
    })
    return response
  }

  // 4. Bypass via Cookie
  const betaAccess = request.cookies.get('hive_beta_access')
  if (betaAccess?.value === 'true') {
    return NextResponse.next()
  }

  // 5. Default: Redirect to Landing Page
  // Prevent infinite redirects: checking if we are already at / is handled by PUBLIC_PATHS check above
  // but explicitly: if we are trying to go anywhere else, send them home.
  return NextResponse.redirect(new URL('/', request.url))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/waitlist (handled in public paths, but we include all api in middleware to be safe)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
