import type { Metadata } from "next";
import LendersView from '@/app/views/LendersView';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rapimoni.com';

export const metadata: Metadata = {
    title: 'Obtén Altos Rendimientos con RapiMoni',
    description: 'Provee liquidez para potenciar microcréditos sin intereses en América Latina y obtén un rendimiento estable y de baja volatilidad, pagado en stablecoins.',
    openGraph: {
        title: 'Obtén Rendimientos Estables y Altos. Impulsa el Crecimiento del Mundo Real.',
        description: 'Provee liquidez al pool auditado de RapiMoni y obtén un APY competitivo que proviene de la actividad económica del mundo real.',
        images: [{ url: `${siteUrl}/social/og-lenders-es.png`}],
    },
    twitter: {
        title: 'Obtén Rendimientos Estables y Altos. Impulsa el Crecimiento del Mundo Real.',
        description: 'Provee liquidez al pool auditado de RapiMoni y obtén un APY competitivo que proviene de la actividad económica del mundo real.',
        images: [`${siteUrl}/social/og-lenders-es.png`],
    },
};

export default function LendersPage() {
    return <LendersView />;
}