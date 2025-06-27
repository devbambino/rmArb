import type { Metadata } from "next";
import MerchantsView from '@/app/views/MerchantsView';

export const metadata: Metadata = {
    title: 'RapiMoni para Comercios',
    description: 'Aumenta tus ventas aceptando pagos digitales y ofreciendo planes de pago a meses sin intereses. Sin hardware, sin contracargos, liquidación al instante.',
    openGraph: {
        title: 'Haz Crecer Tu Negocio con RapiMoni',
        description: 'Atrae más clientes y mejora tu flujo de caja con pagos y microcréditos instantáneos y seguros con pesos y dólares digitales.',
        url: '/',
        siteName: 'RapiMoni',
        images: [
          {
            url: '/social/og-merchants-es.png', // Default image
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
        title: 'Haz Crecer Tu Negocio con RapiMoni',
        description: 'Atrae más clientes y mejora tu flujo de caja con pagos y microcréditos instantáneos y seguros con pesos y dólares digitales.',
        images: ['/social/og-merchants-es.png'], // Default image
      },
};

export default function MerchantHomePage() {
    return <MerchantsView />;
}