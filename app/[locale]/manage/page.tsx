"use client"
import { useAccount, useConnect, useBalance} from "wagmi";
import { useToast } from "@/components/ui/toastprovider";
import { trackEvent } from '@/lib/analytics';
import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from '@/components/LoginButton';

const MXN_ADDR = process.env.NEXT_PUBLIC_MXN_ADDRESS!;
const USD_ADDR = process.env.NEXT_PUBLIC_USD_ADDRESS!;
const UNISWAP_SWAP_MXN_URL = process.env.NEXT_PUBLIC_UNISWAP_SWAP_POOL_FROM_MXN_URL!;
const UNISWAP_SWAP_USD_URL = process.env.NEXT_PUBLIC_UNISWAP_SWAP_POOL_TO_MXN_URL!;

export default function ManagePage() {
    const { showToast } = useToast();
    const { address } = useAccount();
    const { ready, authenticated } = usePrivy();

    const { data: userBalanceInMXNData, refetch: getUserBalanceMXN, isLoading: isUserBalanceInMXNLoading } = useBalance({
        address,
        token: MXN_ADDR as `0x${string}` | undefined,
    });
    const { data: userBalanceInUSDData, refetch: getUserBalanceUSD } = useBalance({
        address,
        token: USD_ADDR as `0x${string}` | undefined,
    });

    const handleWalletConnectClick = (buttonName: string) => {
        trackEvent(
            'wallet_click',      // Action
            'manage',      // Category (page name)
            buttonName        // Label (which button was clicked)
        );
    };

    return (
        <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
            <h1 className="text-3xl font-bold mt-6 mb-6">Manage Now</h1>
            {ready && authenticated ? (
                <>
                    {/* USDC section */}
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        <h2 className="text-2xl font-semibold mb-2">USD Balance</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <div className="text-4xl mb-2">🇺🇸</div>
                        <span className="text-[#50e2c3]">You have</span>
                        <p className="text-2xl font-bold">{Number(userBalanceInUSDData?.formatted).toFixed(2)} USDC</p>
                        <a href={`https://pay.coinbase.com/v3/sell/input?appId=58a3fa2e-617f-4198-81e7-096f5e498c00&partnerUserId=rapiMoniUser&addresses={"${address}":["arbitrum"]}&assets=["USDC"]&redirectUrl=https://www.rapimoni.com/manage`} target="_blank" className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Withdraw To Bank</a>
                        <br />
                    </div>

                    {/* MXN section */}
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        <h2 className="text-2xl font-semibold mb-2">MXN Balance</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <div className="text-4xl mb-2">🇲🇽</div>
                        <span className="text-[#50e2c3]">You have</span>
                        <p className="text-2xl font-bold ">{Number(userBalanceInMXNData?.formatted).toFixed(2)} MXNb</p>
                        <a href={UNISWAP_SWAP_MXN_URL} target="_blank" className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Swap to USDC</a>
                    </div>

                </>
            ) : (
                <div className="mt-8">
                    <p className="text-lg text-gray-500">
                        Please sign in to start managing your balance.
                    </p>
                    <LoginButton
                        size="xl"
                        className="flex items-center mx-auto py-2 px-4 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                    >
                        Get Started
                    </LoginButton>
                </div>
            )}
        </div>
    )
}
