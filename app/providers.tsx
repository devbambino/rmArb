// FILE: app/providers.tsx (Corrected)
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import Layout from "@/components/Layout";
import { config } from "@/wagmi";
import { ToastProvider } from '@/components/ui/toastprovider';
import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl'; // ADDED

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
  const [queryClient] = useState(() => new QueryClient());

  return (
    // ADDED: The provider that gives context to all client components
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <Layout>
            <ToastProvider>{children}</ToastProvider>
          </Layout>
        </QueryClientProvider>
      </WagmiProvider>
    </NextIntlClientProvider>
  );
}