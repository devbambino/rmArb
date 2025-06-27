"use client";

import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { LandmarkIcon, RocketIcon, NotebookPen, QrCodeIcon, HandCoinsIcon, Wallet } from "lucide-react";
import { HowItWorks, type Step } from '@/components/HowItWorks';
import { Testimonials } from '@/components/Testimonials';
import { LeadForm } from '@/components/LeadForm';
import { useTranslations } from 'next-intl';
import { trackEvent } from '@/lib/analytics';

import avatar1 from '@/public/partners/coinbase.svg';
import avatar2 from '@/public/partners/aerodrome.svg';
import avatar3 from '@/public/partners/aave.svg';
import coinbaseLogo from '@/public/partners/coinbase.svg';
import aerodromeLogo from '@/public/partners/aerodrome.svg';
import aaveLogo from '@/public/partners/aave.svg';
import heroMerchant from '@/public/assets/hero-merchant.jpg';
import bnplMerchant from '@/public/assets/bnpl-merchant.jpg';

export default function MerchantsView() {
    const t = useTranslations('merchants');

    const merchantSteps: Step[] = (t.raw('howItWorks.steps') as any[]).map((step: any, index: number) => ({
        ...step,
        step: `${index + 1}`,
        icon: [QrCodeIcon, HandCoinsIcon, Wallet][index]
    }));

    const merchantTestimonials = (t.raw('testimonials.list') as any[]).map((testimonial: any, index: number) => ({
        ...testimonial,
        avatar: [avatar1, avatar2, avatar3][index]
    }));

    const handleCtaClick = (buttonName: string) => {
        trackEvent(
            'cta_click',      // Action
            'merchants',      // Category (page name)
            buttonName        // Label (which button was clicked)
        );
    };

    const handleBaitClick = (buttonName: string) => {
        trackEvent(
            'bait_click',      // Action
            'merchants',      // Category (page name)
            buttonName        // Label (which button was clicked)
        );
    };

    return (
        <>
            <main className="mt-20 mb-20 md:mb-0">
                {/* Hero Section */}
                <section className="flex flex-col text-white items-center text-center">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="flex flex-col mx-auto my-auto py-30 px-20 gap-y-2 text-left">
                            <h1 className="text-4xl md:text-5xl font-bold text-secondary" dangerouslySetInnerHTML={{ __html: t.raw('hero.title') }} />
                            <p className="mt-4 text-lg md:text-xl max-w-3xl mx-auto">
                                {t('hero.subtitle')}
                            </p>
                            <a href="#register" className="mx-auto">
                                <Button
                                    variant="gradient"
                                    size="xl"
                                    className="flex items-center py-2 px-4 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                                    onClick={() => handleCtaClick('hero_get_started')}
                                >
                                    <NotebookPen className="h-4 w-4 text-[#50e2c3] hover:text-gray-900" />
                                    {t('hero.cta')}
                                </Button>
                            </a>
                            <p className="mt-4 text-xs md:text-sm mx-auto max-w-lg text-center">
                                {t.rich('hero.promo', {
                                    plusLink: (chunks) => (
                                        <a
                                            href="#rapimoniplus"
                                            className="font-semibold text-[#50e2c3] text-sm md:text-base underline underline-offset-1"
                                            onClick={() => handleBaitClick('hero_rm_plus_promo')}
                                        >
                                            {chunks}
                                        </a>
                                    ),
                                })}
                            </p>
                        </div>
                        <div className="relative h-full w-full">
                            <Image
                                src={heroMerchant}
                                alt="RapiMoni Merchant Success"
                                className="w-full h-full object-cover object-right-top"
                            />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/50 via-25% to-transparent to-50% pointer-events-none"></div>
                        </div>

                    </div>

                    {/* True insights */}
                    <div id="features" className="max-w-6xl mx-auto px-4 py-10 md:py-30 grid gap-8 grid-cols-1 md:grid-cols-3">
                        {t.raw('features').map((f: any) => (
                            <div key={f.title} className="p-4 bg-primary/90 rounded-lg text-center flex flex-col items-center">
                                <h1 className="text-7xl text-[#50e2c3] font-bold mb-10">{f.insight}</h1>
                                <h3 className="text-xl text-[#50e2c3] font-bold mb-2">{f.title}</h3>
                                <p className="text-neutral">{f.desc}</p>
                            </div>
                        ))}
                    </div>

                </section>

                {/* Partners / Trust Logos */}
                <section
                    id="partners"
                    className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 bg-gray-800 py-10 px-4"
                >
                    <p className="text-neutral font-semibold text-lg mr-6">{t('partners.title')}</p>
                    <Image src={coinbaseLogo} alt="Coinbase" width={100} height={50} />
                    <Image src={aerodromeLogo} alt="Aerodrome" width={100} height={50} />
                    <Image src={aaveLogo} alt="Aave" width={100} height={50} />
                </section>

                {/* BNPL */}
                <section id="bnpl" className="bg-[#F3F4F6] py-10 px-4 sm:px-8 text-black">
                    <div className="flex flex-col md:flex-row max-w-4xl mx-auto items-center">
                        <div className="p-4 text-center mb-6 md:mb-0 md:mr-8">
                            <h2 className="mb-4 text-3xl md:text-4xl font-bold">{t('bnpl.title')}</h2>
                            <Image
                                src={bnplMerchant}
                                alt="Easy RapiMoni BNPL for Merchants"
                                width={200}
                                height={200}
                                className="rounded-lg shadow-md mx-auto"
                            />
                        </div>
                        <div className="p-4 w-full my-auto">
                            <div className="mb-8">
                                <h3 className="font-semibold">{t('bnpl.customerTitle')}</h3>
                                <ul className="list-disc list-inside">
                                    {t.raw('bnpl.customerPoints').map((point: string) => <li className="mt-2" key={point}>{point}</li>)}
                                </ul>
                                <div className="w-full h-px bg-black mt-2"></div>
                            </div>
                            <div>
                                <h3 className="font-semibold">{t('bnpl.merchantTitle')}</h3>
                                <ul className="list-disc list-inside">
                                    {t.raw('bnpl.merchantPoints').map((point: string) => <li className="mt-2" key={point}>{point}</li>)}
                                </ul>
                                <div className="w-full h-px bg-black mt-2"></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How It Works section*/}
                <HowItWorks
                    id="merchants-how-it-works"
                    heading={t('howItWorks.title')}
                    steps={merchantSteps}
                />

                {/* CTA section */}
                <section className="flex flex-col text-white items-center text-center mb-20 px-4">
                    <a href="#register">
                        <Button
                            variant="gradient"
                            size="xl"
                            className="flex items-center py-2 px-4 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                            onClick={() => handleCtaClick('middle_get_started')}
                        >
                            <NotebookPen className="h-4 w-4 text-[#50e2c3] hover:text-gray-900" />
                            {t('hero.cta')}
                        </Button>
                    </a>
                    <p className="mt-4 text-xs md:text-sm mx-auto max-w-lg">
                        {t.rich('hero.promo', {
                            plusLink: (chunks) => <a href="#rapimoniplus" className="font-semibold text-[#50e2c3] text-sm md:text-base underline underline-offset-1" onClick={() => handleBaitClick('middle_rm_plus_promo')}>{chunks}</a>
                        })}
                    </p>
                </section>

                {/* RapiMoni+ */}
                <section id="rapimoniplus" className="bg-[#F3F4F6] py-16 px-4 sm:px-8 text-black">
                    <div className="flex flex-col md:flex-row max-w-3xl mx-auto items-center">
                        <div className="p-4 text-center md:text-left mb-6 md:mb-0 md:mr-8">
                            <RocketIcon className="h-20 w-20 mb-2 mx-auto md:mx-0" />
                            <h2 className="text-3xl md:text-4xl font-bold">{t('rapimoniPlus.title')}</h2>
                        </div>
                        <div className="p-4 w-full">
                            <div className="mb-8">
                                <h3 className="font-semibold">{t('rapimoniPlus.benefitsTitle')}</h3>
                                <ul className="list-disc list-inside">
                                    {t.raw('rapimoniPlus.benefitsPoints').map((point: string) => <li className="mt-2" key={point}>{point}</li>)}
                                </ul>
                                <div className="w-full h-px bg-black mt-2"></div>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">{t('rapimoniPlus.costTitle')}</h3>
                                <p>{t('rapimoniPlus.costDesc')}</p>
                                <div className="w-full h-px bg-black mt-2"></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Testimonials 
                <Testimonials
                    title={t('testimonials.title')}
                    testimonials={merchantTestimonials}
                />*/}

                <LeadForm type="merchant" />
            </main>
        </>
    );
}