import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Wallet, Copy, AlertCircle } from "lucide-react";
import { cbWalletConnector } from "@/wagmi";
import { trackEvent } from '@/lib/analytics';
import { toast } from "sonner";

export const WalletConnect = () => {
  const account = useAccount();
  const { connectors, connect, error } = useConnect();
  const { disconnect } = useDisconnect();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const formatAddress = (address: string | undefined) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleWalletConnectClick = (buttonName: string) => {
    trackEvent(
      'wallet_click',      // Action
      'header',      // Category (page name)
      buttonName        // Label (which button was clicked)
    );
  };

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-6 slide-in-from-top animate-in">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        {account.status === "connected" ? (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-white rounded-full flex items-center gap-2 border border-[#264C73] shadow-sm">
              <div className="w-2 h-2 rounded-full bg-[#264C73]"></div>
              <span className="text-xs font-medium text-[#264C73]">{formatAddress(account.address)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-[#264C73]"
                onClick={() => account.address && copyToClipboard(account.address)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                disconnect();
                handleWalletConnectClick('header_mob_disconnect');
              }}
              className="text-xs text-[#50e2c3] rounded-full border-[#50e2c3] rd hover:bg-[#50e2c3] hover:text-gray-900"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">

            <Button
              onClick={() => {
                connect({ connector: cbWalletConnector });
                handleWalletConnectClick('header_mob_connect');
              }}
              variant="gradient"
              size="sm"
              className="flex items-center gap-1.5 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
            >
              <Wallet className="h-4 w-4 text-[#50e2c3] hover:text-white" />
              Sign In
            </Button>
          </div>
        )}
      </div>
    </>
  );
}; 