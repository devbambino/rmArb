"use client";

import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { HowItWorks, type Step } from '@/components/HowItWorks';
import { Testimonials } from '@/components/Testimonials';
import { LeadForm } from '@/components/LeadForm';
import { DatabaseZap, BarChartBig, DownloadCloud, ShieldCheck, TrendingUp, HeartHandshake, Banknote, LineChart, NotebookPen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { trackEvent } from '@/lib/analytics';

import avatar1 from '@/public/partners/aave.svg';
import avatar2 from '@/public/partners/coinbase.svg';
import avatar3 from '@/public/partners/aerodrome.svg';
import coinbaseLogo from '@/public/partners/coinbase.svg';
import aaveLogo from '@/public/partners/aave.svg';
import aerodromeLogo from '@/public/partners/aerodrome.svg';
import heroLender from '@/public/assets/hero-lender.jpg';

export default function LendersView() {
    const t = useTranslations('lenders');

    const lenderSteps: Step[] = (t.raw('howItWorks.steps') as any[]).map((step: any, index: number) => ({
        ...step,
        step: `${index + 1}`,
        icon: [DatabaseZap, BarChartBig, DownloadCloud][index]
    }));

    const lenderTestimonials = (t.raw('testimonials.list') as any[]).map((testimonial: any, index: number) => ({
        ...testimonial,
        avatar: [avatar1, avatar2, avatar3][index]
    }));

    const handleCtaClick = (buttonName: string) => {
        trackEvent(
            'cta_click',      // Action
            'lenders',        // Category
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
                                onClick={() => handleCtaClick('hero_join_pool')}
                            >
                                <NotebookPen className="h-5 w-5 text-[#50e2c3] hover:text-gray-900" />
                                {t('hero.cta')}
                            </Button>
                        </a>
                    </div>
                    <div className="relative h-full w-full"> 
                        <Image
                            src={heroLender} 
                            alt="RapiMoni - Earn Stable Yields, Fuel Growth"
                            className="w-full h-full object-cover object-right-top"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/50 via-25% to-transparent to-50% pointer-events-none"></div>
                    </div>

                </div>
            </section>

            {/* Why Lend Section */}
            <section className="bg-gray-800 py-20 px-4">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('why.title')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
                        {t.raw('why.points').map((point: any, index: number) => {
                            const Icon = [ShieldCheck, TrendingUp, HeartHandshake][index];
                            return (
                                <div key={point.title} className="flex flex-col items-center">
                                    <Icon className="h-12 w-12 text-secondary mb-4" />
                                    <h3 className="text-xl font-semibold mb-2">{point.title}</h3>
                                    <p className="text-neutral">{point.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <HowItWorks
                id="lenders-how-it-works"
                heading={t('howItWorks.title')}
                steps={lenderSteps}
            />

            {/* Stats & Trust Section */}
            <section className="bg-gray-800 py-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('stats.title')}</h2>
                    <p className="text-lg mb-12 max-w-2xl mx-auto">{t('stats.subtitle')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-primary/50 p-6 rounded-lg">
                            <Banknote className="h-10 w-10 text-secondary mx-auto mb-4" />
                            <div className="text-4xl font-bold text-white">~MXN$K</div>
                            <p className="text-neutral mt-2">{t('stats.tvl')}</p>
                        </div>
                        <div className="bg-primary/50 p-6 rounded-lg">
                            <LineChart className="h-10 w-10 text-secondary mx-auto mb-4" />
                            <div className="text-4xl font-bold text-white">~10%</div>
                            <p className="text-neutral mt-2">{t('stats.apy')}</p>
                        </div>
                        <div className="bg-primary/50 p-6 rounded-lg">
                            <TrendingUp className="h-10 w-10 text-secondary mx-auto mb-4" />
                            <div className="text-4xl font-bold text-white">%</div>
                            <p className="text-neutral mt-2">{t('stats.uptime')}</p>
                        </div>
                    </div>
                    <p className="text-neutral font-semibold text-lg mt-12 mb-6">{t('stats.partnersTitle')}</p>
                    <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
                        <Image src={coinbaseLogo} alt="Coinbase" width={100} height={50} />
                        <Image src={aaveLogo} alt="Aave" width={80} height={40} />
                        <Image src={aerodromeLogo} alt="Aerodrome" width={100} height={50} />
                    </div>
                </div>
            </section>

            {/* Testimonials Section 
            <Testimonials
                title={t('testimonials.title')}
                testimonials={lenderTestimonials}
            />*/}

            <LeadForm type="lender" />
        </main>
    );
}