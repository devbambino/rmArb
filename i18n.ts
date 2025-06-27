// FILE: i18n.ts (Corrected, Final Version)

import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'es'];

export default getRequestConfig(async ({ locale }) => {
  // Use a type-safe check to see if the locale is valid.
  if (!locale) notFound();
  const baseLocale = new Intl.Locale(locale).baseName;
  if (!locales.includes(baseLocale)) {
    notFound();
  }

  return {
    locale: baseLocale,
    messages: (await import(`./messages/${baseLocale}.json`)).default,
    timeZone: 'America/Mexico_City'
  };
});