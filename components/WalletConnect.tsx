// FILE: components/WalletConnect.tsx (MODIFIED)
'use client';

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, AlertCircle } from "lucide-react";
import { trackEvent } from '@/lib/analytics';
import { toast } from "sonner";
import { LoginButton } from "./LoginButton"; // NEW: Import our unified button

export const WalletConnect = () => {
  const { ready, authenticated, user, logout, exportWallet } = usePrivy();
  const { wallets } = useWallets();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const formatAddress = (address: string | undefined) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleLogoutClick = () => {
    trackEvent('wallet_click', 'header', 'logout');
    logout();
  };

  // Find the embedded wallet from the list of all connected wallets
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
  const userAddress = embeddedWallet?.address;

  // Wait until Privy is ready and the user is authenticated
  if (!ready) {
    return null; // Or a loading spinner
  }

  return (
    <div className="flex items-center gap-3">
      {authenticated && userAddress ? (
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-white rounded-full flex items-center gap-2 border border-[#264C73] shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[#264C73]"></div>
            <span className="text-xs font-medium text-[#264C73]">{formatAddress(userAddress)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-[#264C73]"
              onClick={() => userAddress && copyToClipboard(userAddress)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogoutClick}
            className="text-xs text-[#50e2c3] rounded-full border-[#50e2c3] rd hover:bg-[#50e2c3] hover:text-gray-900"
          >
            Disconnect
          </Button>
        </div>
      ) : (
        // Use our new unified login button
        <LoginButton
          size="sm"
          className="bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
        >
          Sign In
        </LoginButton>
      )}
    </div>
  );
};