// FILE: app/providers.tsx (Corrected)
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from '@privy-io/wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import Layout from "@/components/Layout";
import { config } from "@/wagmi";
import { privyConfig } from "@/privyConfig";
import { ToastProvider } from '@/components/ui/toastprovider';
import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl'; // ADDED

//const [queryClient] = useState(() => new QueryClient());
const queryClient = new QueryClient();

// MODIFIED: Update props to accept locale and messages
export function Providers({
  children,
  locale,
  messages
}: {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}) {
  return (
    // ADDED: The provider that gives context to all client components
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!} config={privyConfig}>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={config}>
            <Layout>
              <ToastProvider>{children}</ToastProvider>
            </Layout>
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </NextIntlClientProvider>
  );
}