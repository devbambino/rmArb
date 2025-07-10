// FILE: components/Header.tsx 
import Image from 'next/image';
import { useState } from 'react';
import { useAccount } from "wagmi";
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import LocaleSwitcher from './LocaleSwitcher';
import { useTranslations } from 'next-intl';
import { trackEvent } from '@/lib/analytics';
import { usePrivy } from '@privy-io/react-auth';

import logo from '@/public/logo-sm.png';

export default function Header() {
    const [isOpen, setOpen] = useState(false);
    const account = useAccount();
    const { ready, authenticated } = usePrivy();

    const t = useTranslations('navigation');

    const loggedOutLinks = [
        { href: '/borrowers', key: 'borrowers' },
        { href: '/lenders', key: 'lenders' },
    ];

    const loggedInLinks = [
        { href: '/pay', key: 'pay' },
        { href: '/charge', key: 'charge' },
        { href: '/borrow', key: 'borrow' },
        { href: '/lend', key: 'lend' },
        { href: '/manage', key: 'manage' },
    ];

    const handleNavigationClick = (buttonName: string) => {
        trackEvent(
            'navigation_click',      // Action
            'header',      // Category (page name)
            buttonName        // Label (which button was clicked)
        );
    };


    return (
        <header className="fixed top-0 w-full bg-primary/95 backdrop-blur-sm z-50">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
                <Link href="/">
                    <Image src={logo} alt="RapiMoni" width={120} height={32} />
                </Link>
                {/* Desktop Nav */}
                <nav className="hidden md:flex space-x-6 text-white">
                    {ready && authenticated ? (
                        loggedInLinks.map(link => (
                            <Link key={link.key} href={link.href} className="hover:underline hover:text-[#50e2c3]"
                                onClick={() => handleNavigationClick('header_' + link.key)}>
                                {t(link.key)}
                            </Link>
                        ))
                    ) : (
                        loggedOutLinks.map(link => (
                            <Link key={link.key} href={link.href} className="hover:underline hover:text-[#50e2c3]"
                                onClick={() => handleNavigationClick('header_' + link.key)}>
                                {t(link.key)}
                            </Link>
                        ))
                    )}
                </nav>

                {/* <WalletConnect /> removed for now */}
                <div className="hidden md:flex items-center gap-4">
                    <LocaleSwitcher />
                </div>
                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-white focus:outline-none"
                    onClick={() => setOpen(!isOpen)}
                    aria-label={t('toggleMenu')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                    </svg>
                </button>
            </div>
            {/* Mobile Nav */}
            {isOpen && (
                <nav className="md:hidden bg-primary/90 px-4 py-2 space-y-2">
                    {ready && authenticated ? (
                        loggedInLinks.map((link) => (
                            <Link
                                key={link.key}
                                href={link.href}
                                className="block text-white py-1 hover:underline"
                                onClick={() => {
                                    setOpen(false);// Close menu on click
                                    handleNavigationClick('header_mob_' + link.key);
                                }} 
                            >
                                {t(link.key)}
                            </Link>
                        ))
                    ) : (
                        loggedOutLinks.map((link) => (
                            <Link
                                key={link.key}
                                href={link.href}
                                className="block text-white py-1 hover:underline"
                                onClick={() => {
                                    setOpen(false);// Close menu on click
                                    handleNavigationClick('header_mob_' + link.key);
                                }} 
                            >
                                {t(link.key)}
                            </Link>
                        ))
                    )}
                    {/* <WalletConnect /> removed for now */}
                    <div className="mt-4 border-t border-[#50e2c3] pt-4 flex flex-col items-start gap-4">
                        <LocaleSwitcher />
                        <WalletConnect />
                    </div>
                </nav>
            )}
        </header>
    );
}