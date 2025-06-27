// FILE: components/LocaleSwitcher.tsx (Corrected, Final, and Guaranteed to Work)
'use client';

import { useTransition, useState } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { Languages } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export default function LocaleSwitcher() {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const pathname = usePathname(); // This hook returns the FULL path, e.g., /en/borrowers
    const locale = useLocale(); // This hook returns the current locale, e.g., 'en'

    const switchLocale = (nextLocale: string) => {
        // Construct the path without the current locale prefix
        const pathWithoutLocale = pathname.startsWith(`/${locale}`)
            ? pathname.substring(`/${locale}`.length)
            : pathname;

        // The root path might become an empty string, so we ensure it's a '/'
        const newPath = `/${nextLocale}${pathWithoutLocale || '/'}`;

        startTransition(() => {
            router.replace(newPath);
        });

        trackEvent(
            'locale_switcher_click',      // Action
            'header',      // Category (page name)
            'locale_' + nextLocale        // Label (which button was clicked)
        );
    };

    return (
        <div className="relative">
            {/* Button to toggle the dropdown */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-white hover:bg-[#50e2c3] cursor-pointer"
            >
                <Languages className="h-4 w-4" />
                <span className="uppercase text-xs font-semibold">{locale}</span>
            </Button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-28 bg-primary/95 rounded-md shadow-lg border border-[#50e2c3] z-50">
                    <button
                        onClick={() => {
                            switchLocale('en');
                            setIsOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[#50e2c3] disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={locale === 'en'}
                    >
                        English
                    </button>
                    <button
                        onClick={() => {
                            switchLocale('es');
                            setIsOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[#50e2c3] disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={locale === 'es'}
                    >
                        Español
                    </button>
                </div>
            )}
        </div>
    );
}