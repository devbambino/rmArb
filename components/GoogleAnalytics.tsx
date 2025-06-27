"use client";

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Script from 'next/script';
import { trackEvent } from '@/lib/analytics'; // We can reuse our helper

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function GoogleAnalytics() {
  const pathname = usePathname();

  // This effect hook tracks page views when the pathname changes.
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) {
      return;
    }
    // The gtag function is defined by the script we load below.
    window.gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: true,
      page_path: pathname,
    });
  }, [pathname]);

  // If the Measurement ID is not set, we don't render anything.
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      {/* The main Google Analytics script */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      {/* A small inline script to initialize the data layer */}
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}