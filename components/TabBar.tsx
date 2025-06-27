import Link from 'next/link';
import { useAccount } from "wagmi";
import { useRouter, usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import {
  CreditCardIcon, BuildingLibraryIcon, QrCodeIcon, BanknotesIcon, Cog6ToothIcon
} from '@heroicons/react/24/outline';

const tabs = [
  { href: '/pay', icon: CreditCardIcon, label: 'Pay' },
  { href: '/charge', icon: QrCodeIcon, label: 'Charge' },
  { href: '/borrow', icon: BuildingLibraryIcon, label: 'Borrow' },
  { href: '/lend', icon: BanknotesIcon, label: 'Lend' },
  { href: '/manage', icon: Cog6ToothIcon, label: 'Manage' },
];

export default function TabBar() {
  const router = useRouter();
  const account = useAccount();
  const pathname = usePathname()

  const handleNavigationClick = (buttonName: string) => {
    trackEvent(
      'navigation_click',      // Action
      'tabsbar',      // Category (page name)
      buttonName        // Label (which button was clicked)
    );
  };

  return (
    <div>
      {account.status === "connected" && (
        <nav className="fixed bottom-0 w-full bg-primary/95 backdrop-blur-sm border-t border-primary/70 md:hidden">

          <ul className="flex justify-around py-2">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <li key={tab.href}>
                  <Link href={tab.href} className="flex flex-col items-center text-xs"
                    onClick={() => handleNavigationClick('header_' + tab.label.toLowerCase())}>
                    <tab.icon className={`h-6 w-6 ${isActive ? 'text-secondary' : 'text-neutral'}`} />
                    <span className={`${isActive ? 'text-secondary' : 'text-neutral'}`}>{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

      )}
    </div>


  );
}
