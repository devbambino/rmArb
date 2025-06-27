import type { Metadata } from "next";
import BorrowersView from '@/app/views/BorrowersView';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rapimoni.com';

export const metadata: Metadata = {
    title: 'Paga a Tu Manera con RapiMoni',
    description: 'Paga completo o divide tu compra en pagos fáciles y sin intereses. Sin tarjeta de crédito, sin complicaciones. La forma inteligente de pagar.',
    openGraph: {
        title: 'La Forma Inteligente de Pagar. Flexible, Justo y Simple.',
        description: '¿Viste un código QR de RapiMoni? Paga ahora con pesos/dólares digitales o divide tu compra en pagos fáciles y sin intereses.',
        images: [{ url: `${siteUrl}/social/og-borrowers-es.png`}],
    },
    twitter: {
        title: 'La Forma Inteligente de Pagar. Flexible, Justo y Simple.',
        description: '¿Viste un código QR de RapiMoni? Paga ahora con pesos/dólares digitales o divide tu compra en pagos fáciles y sin intereses.',
        images: [{ url: `${siteUrl}/social/og-borrowers-es.png` }],
    },
};

export default function BorrowersPage() {
    return <BorrowersView />;
}