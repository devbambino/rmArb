import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // A list of all locales that are supported
  locales: ['en', 'es'],

  // Used when no locale matches
  defaultLocale: 'en'
});

export const config = {
  // CORRECTED: This matcher is more robust and will run on all paths
  // except for the ones that start with:
  // - api (API routes)
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - social (your social images folder)
  // - favicon.ico (favicon file)
  matcher: ['/((?!api|_next/static|_next/image|social|favicon.ico).*)']
};