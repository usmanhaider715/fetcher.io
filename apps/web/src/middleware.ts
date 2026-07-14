import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  if (host.startsWith('app.') && !pathname.startsWith('/dashboard') && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (host.startsWith('admin.') && !pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (host.startsWith('docs.') && !pathname.startsWith('/docs')) {
    return NextResponse.redirect(new URL('/docs', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
