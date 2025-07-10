"use client"
import { useState, useEffect } from "react";
import { useAccount, useConnect, useWriteContract, useReadContract, useWaitForTransactionReceipt, useBalance, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { liquidityPoolAbi } from "@/lib/liquiditypool-abi";
import { feePoolAbi } from "@/lib/feepool-abi";
import { usdcAbi } from "@/lib/usdc-abi";
import { parseUnits, formatUnits } from 'viem';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toastprovider";

import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from '@/components/LoginButton';

import { Wallet } from "lucide-react";
import { trackEvent } from '@/lib/analytics';

const LP_ADDR = process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS!;
const FP_ADDR = process.env.NEXT_PUBLIC_FEE_POOL_ADDRESS!;
const MXN_ADDR = process.env.NEXT_PUBLIC_MXN_ADDRESS!;

// A sensible default APY to show to users
const estimatedAPY = 10.8; // 12 months * 0.9% yield from fees

export default function LendPage() {
    const { showToast } = useToast();
    const { connect } = useConnect();
    const { ready, authenticated } = usePrivy();
    const { address } = useAccount(); // Get the real-time chain object
    const [depositAmt, setDepositAmt] = useState("");

    const { data: userBalanceInMXNData, refetch: getUserBalanceMXN } = useBalance({
        address,
        token: MXN_ADDR as `0x${string}` | undefined,
    });
    const { data: poolBalanceInMXNData, refetch: getPoolBalanceMXN } = useBalance({
        address: LP_ADDR as `0x${string}`,
        token: MXN_ADDR as `0x${string}` | undefined,
    });

    // Fetch pool info
    const { data: totalShares, refetch: getTotalShares, isLoading: isTotalSharesLoading } = useReadContract({
        address: LP_ADDR as `0x${string}`,
        abi: liquidityPoolAbi,
        functionName: 'totalShares',
        query: { enabled: !!address }
    });

    // Fetch user's info
    const { data: userShares, refetch: getUserShares, isLoading: isUserSharesLoading } = useReadContract({
        address: LP_ADDR as `0x${string}`,
        abi: liquidityPoolAbi,
        functionName: 'shares',
        args: [address!],
        query: { enabled: !!address }
    });

    // NEW: Fetch user's earned fees using the new `earned` function
    const { data: userEarnedFees, refetch: getUserEarnedFees, isLoading: isUserEarnedFeesLoading } = useReadContract({
        address: FP_ADDR as `0x${string}`,
        abi: feePoolAbi,
        functionName: 'earned',
        args: [address!],
        query: {
            enabled: !!address && !!userShares && userShares > 0,
            refetchInterval: 30000, // Refetch every 30 seconds
        }
    });

    const { data: approveDepositHash, writeContractAsync: approveDeposit, isPending: approveDepositIsPending } = useWriteContract();
    const { data: depositHash, writeContractAsync: deposit, isPending: depositIsPending } = useWriteContract();
    const { isLoading: depositConfirming, isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositHash });

    const { data: claimHash, writeContractAsync: claim, isPending: claimIsPending } = useWriteContract();
    const { isLoading: claimConfirming, isSuccess: claimConfirmed } = useWaitForTransactionReceipt({ hash: claimHash });

    const { data: withdrawHash, writeContractAsync: withdraw, isPending: withdrawIsPending } = useWriteContract();
    const { isLoading: withdrawConfirming, isSuccess: withdrawConfirmed } = useWaitForTransactionReceipt({ hash: withdrawHash });

    const handleWalletConnectClick = (buttonName: string) => {
        trackEvent('wallet_click', 'lend', buttonName);
    };

    useEffect(() => {
        if (address) {
            getTotalShares();
            getUserShares();
            getUserBalanceMXN();
            getPoolBalanceMXN();
            if (userShares && userShares > 0) {
                getUserEarnedFees();
            }
        }
    }, [depositConfirmed, claimConfirmed, withdrawConfirmed, address, userShares]);

    const onDeposit = async () => {
        if (!depositAmt || !address) return;

        try {
            getUserBalanceMXN();
            const userBalanceInMXN = userBalanceInMXNData?.value ?? BigInt(0);
            if (parseUnits(depositAmt, 6) > userBalanceInMXN) {
                showToast("You don't have enough MXNb to deposit.", "error");
                return;
            }

            if (userShares && userShares > 0) {
                showToast("You have already deposited funds. To add more, please withdraw your current position first.", "error")
                return;
            }

            await approveDeposit({
                abi: usdcAbi,
                address: MXN_ADDR as `0x${string}`,
                functionName: 'approve',
                args: [LP_ADDR as `0x${string}`, parseUnits(depositAmt, 6)],
            });

            await deposit({
                address: LP_ADDR as `0x${string}`,
                abi: liquidityPoolAbi,
                functionName: 'deposit',
                args: [parseUnits(depositAmt, 6)],
            });

            setDepositAmt("");
            showToast("Deposit successful!", "success");

        } catch (err: any) {
            const errorStr = err?.message || err?.reason || JSON.stringify(err);
            if (errorStr.includes("rejected")) {
                showToast("Transaction rejected.", "error");
            } else {
                showToast("An error occurred during deposit.", "error");
            }
            console.error("Deposit Error:", err);
        }
    };

    const onClaim = async () => {
        if (!address || !userEarnedFees || userEarnedFees <= BigInt(0)) {
            showToast("You have no rewards to claim.", "info");
            return;
        }

        try {
            await claim({
                address: FP_ADDR as `0x${string}`,
                abi: feePoolAbi,
                functionName: 'claim'
            });
            showToast("Claim transaction sent!", "success");

        } catch (err: any) {
            const errorStr = err?.message || err?.reason || JSON.stringify(err);
            if (errorStr.includes("rejected")) {
                showToast("Transaction rejected.", "error");
            } else {
                showToast("An error occurred during claim.", "error");
            }
            console.error("Claim Error:", err);
        }
    };

    const onWithdraw = async () => {
        if (!address || !userShares || userShares <= BigInt(0)) return;

        try {
            // REMOVED: Time lock and pending claim checks are obsolete with the new contracts.
            // A user can withdraw their principal while their rewards remain in the FeePool to be claimed separately.
            const poolBalance = poolBalanceInMXNData?.value ?? BigInt(0);
            if (userShares > poolBalance) {
                showToast("Not enough liquid MXNb in the pool for a full withdrawal yet. Please try again later.", "error");
                return;
            }
            await withdraw({
                address: LP_ADDR as `0x${string}`,
                abi: liquidityPoolAbi,
                functionName: 'withdraw'
            });
            showToast("Withdrawal transaction sent!", "success");

        } catch (err: any) {
            const errorStr = err?.message || err?.reason || JSON.stringify(err);
            if (errorStr.includes("rejected")) {
                showToast("Transaction rejected.", "error");
            } else {
                showToast("An error occurred during withdrawal.", "error");
            }
            console.error("Withdrawal Error:", err);
        }
    };

    // Derived values for UI
    const totalSharesNum = Number(totalShares ?? 0);
    const poolBalanceNum = Number(poolBalanceInMXNData?.value ?? 0);
    const utilizationRatio = totalSharesNum > 0 ? (100 - (100 * poolBalanceNum / totalSharesNum)) : 0;
    const canClaim = userEarnedFees && userEarnedFees > BigInt(0);

    return (
        <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
            <h1 className="text-3xl font-bold mt-6 mb-6">Lend Now</h1>
            {ready && authenticated ? (
                <>
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        {withdrawConfirming && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                <p>Processing withdrawal...</p>
                            </div>
                        )}
                        <h2 className="text-2xl font-semibold mb-2">Lending Pool</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />

                        <span className="text-[#50e2c3]">Total Value Locked</span>
                        <p className="text-xl">{`${formatUnits(totalShares ?? BigInt(0), 6)} MXNb`}</p>

                        <span className="text-[#50e2c3]">Utilization Ratio</span>
                        <p className="text-xl">{utilizationRatio.toFixed(2)}%</p>

                        <span className="text-[#50e2c3]">Your Share</span>
                        <p className="text-xl">{`${formatUnits(userShares ?? BigInt(0), 6)} MXNb`}</p>

                        <span className="text-[#50e2c3]">Target APY</span>
                        <p className="text-xl">~{estimatedAPY}%</p>

                        {(userShares ?? BigInt(0)) > 0 && (
                            <Button onClick={onWithdraw} disabled={withdrawIsPending || withdrawConfirming} className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">{withdrawIsPending || withdrawConfirming ? "Withdrawing…" : "Withdraw"}</Button>
                        )}
                    </div>

                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        {depositConfirming && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                <p>Processing deposit...</p>
                            </div>
                        )}
                        <h2 className="text-2xl font-semibold mb-2">Deposit MXNb</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <Input
                            type="number"
                            placeholder="Amount in MXNb"
                            value={depositAmt}
                            onChange={e => setDepositAmt(e.target.value)}
                            className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                            disabled={(userShares ?? BigInt(0)) > 0}
                        />
                        <Button onClick={onDeposit} disabled={approveDepositIsPending || depositIsPending || (userShares ?? BigInt(0)) > 0} className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">{approveDepositIsPending || depositIsPending ? "Depositing…" : (userShares ?? BigInt(0)) > 0 ? "Withdraw to deposit again" : "Deposit"}</Button>
                        <p className="text-sm text-gray-400">(You have {userBalanceInMXNData?.formatted ?? '0.00'} MXNb)</p>
                    </div>

                    {(userShares ?? BigInt(0)) > 0 && (
                        <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                            {claimConfirming && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                    <p>Processing claim...</p>
                                </div>
                            )}
                            <h2 className="text-2xl font-semibold mb-2">Claim Rewards</h2>
                            <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                            <span className="text-[#50e2c3]">Available to Claim</span>
                            <p className="text-xl">{isUserEarnedFeesLoading ? 'Loading...' : `${formatUnits(userEarnedFees ?? BigInt(0), 6)} MXNb`}</p>
                            <Button onClick={onClaim} disabled={claimIsPending || claimConfirming || !canClaim} className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">{claimIsPending || claimConfirming ? "Claiming…" : "Claim"}</Button>
                        </div>
                    )}
                </>
            ) : (
                <div className="mt-8">
                    <p className="text-lg text-gray-500">
                        Please sign in to make deposits and claim rewards.
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