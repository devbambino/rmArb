"use client";

import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { HowItWorks, type Step } from '@/components/HowItWorks';
import { Testimonials } from '@/components/Testimonials';
import { LeadForm } from '@/components/LeadForm';
import { ScanLine, MousePointerSquareDashed, CheckSquare, NotebookPen, CreditCard, Split, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { trackEvent } from '@/lib/analytics';

import avatar1 from '@/public/partners/aave.svg';
import avatar2 from '@/public/partners/coinbase.svg';
import avatar3 from '@/public/partners/aerodrome.svg';
import heroBorrower from '@/public/assets/hero-borrower.jpg';

export default function BorrowersView() {
    const t = useTranslations('borrowers');

    const borrowerSteps: Step[] = (t.raw('howItWorks.steps') as any[]).map((step: any, index: number) => ({
        ...step,
        step: `${index + 1}`,
        icon: [ScanLine, MousePointerSquareDashed, CheckSquare][index]
    }));

    const borrowerTestimonials = (t.raw('testimonials.list') as any[]).map((testimonial: any, index: number) => ({
        ...testimonial,
        avatar: [avatar1, avatar2, avatar3][index]
    }));

    const handleCtaClick = (buttonName: string) => {
        trackEvent(
            'cta_click',      // Action
            'borrowers',      // Category
            buttonName        // Label
        );
    };

    return (
        <main className="mt-20 mb-20 md:mb-0">
            {/* Hero Section */}
            <section className="flex flex-col text-white items-center text-center">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="flex flex-col mx-auto my-auto py-30 px-20 gap-y-2 text-left">
                        <h1 className="text-4xl md:text-5xl font-bold text-secondary" dangerouslySetInnerHTML={{ __html: t.raw('hero.title') }} />
                        <p className="mt-4 text-lg md:text-xl max-w-3xl mx-auto">
                            {t('hero.subtitle')}
                        </p>
                        <a href="#register">
                            <Button
                                variant="gradient"
                                size="xl"
                                className="flex items-center py-2 px-4 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                                onClick={() => handleCtaClick('hero_get_notified')}
                            >
                                <NotebookPen className="h-5 w-5 text-[#50e2c3] hover:text-gray-900" />
                                {t('hero.cta')}
                            </Button>
                        </a>
                    </div>
                    <div className="relative h-full w-full">
                        <Image
                            src={heroBorrower}
                            alt="RapiMoni - Easy Payments for Shoppers"
                            className="w-full h-full object-cover object-right-top"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/50 via-25% to-transparent to-50% pointer-events-none"></div>
                    </div>
                </div>
            </section>

            {/* Why Use RapiMoni Section */}
            <section className="bg-gray-800 py-20 px-4">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white">{t('why.title')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
                        {t.raw('why.points').map((point: any, index: number) => {
                            const Icon = [CreditCard, Split, ShieldCheck][index];
                            return (
                                <div key={point.title} className="flex flex-col items-center">
                                    <Icon className="h-12 w-12 text-secondary mb-4" />
                                    <h3 className="text-xl font-semibold mb-2 text-white">{point.title}</h3>
                                    <p className="text-neutral">{point.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <HowItWorks
                id="borrowers-how-it-works"
                heading={t('howItWorks.title')}
                steps={borrowerSteps}
            />

            {/* Request RapiMoni Section */}
            <section className="bg-[#F3F4F6] py-16 px-4 text-center text-black">
                <div className="max-w-3xl mx-auto">
                    <ScanLine className="h-20 w-20 mx-auto mb-4" />
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('request.title')}</h2>
                    <p className="text-lg mb-8">
                        {t.rich('request.desc', {
                            link: (chunks) => (
                                <a href="/" className="text-moniblue font-bold underline">
                                    {chunks}
                                </a>
                            ),
                        })}
                    </p>
                    <p className="text-sm">{t('request.cta')}</p>
                </div>
            </section>

            {/* Testimonials Section 
            <Testimonials
                title={t('testimonials.title')}
                testimonials={borrowerTestimonials}
            />*/}

            <LeadForm type="borrower" />
        </main>
    );
}