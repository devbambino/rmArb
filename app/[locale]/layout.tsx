import type { Metadata } from "next";
import { Providers } from "../providers";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { notFound } from 'next/navigation';
import { AbstractIntlMessages } from 'next-intl';
import { Analytics } from "@vercel/analytics/next";
import GoogleAnalytics from '@/components/GoogleAnalytics';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rapimoni.com';

export const metadata: Metadata = {
  // Use a title template for brand consistency
  title: {
    template: '%s | RapiMoni',
    default: 'RapiMoni | Pagos con Pesos o Dólares y Microcréditos sin Intereses',
  },
  description: "RapiMoni trae pagos con Pesos o Dólares y microcréditos sin intereses a LATAM. Potenciando compras, potenciándote a ti.",
  metadataBase: new URL(siteUrl), // Sets the base for all relative URLs
  openGraph: {
    title: 'RapiMoni | Pagos con Pesos o Dólares y Microcréditos sin Intereses',
    description: 'Atrae más clientes y mejora tu flujo de caja con pagos y microcréditos instantáneos y seguros con pesos y dólares digitales.',
    url: '/',
    siteName: 'RapiMoni',
    images: [
      {
        url: `${siteUrl}/social/og-merchants-es.png`, // Default image
        width: 1200,
        height: 630,
        alt: 'RapiMoni para Comercios',
      },
    ],
    locale: 'en_MX', // Default locale
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RapiMoni | Pagos con Pesos o Dólares y Microcréditos sin Intereses',
    description: 'Atrae más clientes y mejora tu flujo de caja con pagos y microcréditos instantáneos y seguros con pesos y dólares digitales.',
    images: [`${siteUrl}/social/og-merchants-es.png`], // Default image
  },
};

// This signature is correct for an async Server Component reading params.
export default async function RootLayout({
  children,
  params: { locale },
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  let messages: AbstractIntlMessages;
  try {
    // This is the correct, robust way to load messages on the server.
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    notFound();
  }

  return (
    <html lang={locale} className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleAnalytics />
        <Analytics />
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}