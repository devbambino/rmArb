"use client"
import { useState, useEffect } from "react";
import { useAccount, useConnect, useWriteContract, useReadContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { liquidityPoolAbi } from "@/lib/liquiditypool-abi";
import { microloanAbi } from "@/lib/microloan-abi";
import { feePoolAbi } from "@/lib/feepool-abi";
import { usdcAbi } from "@/lib/usdc-abi";
import { parseUnits, formatUnits } from 'viem';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toastprovider";
import { trackEvent } from '@/lib/analytics';
import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from '@/components/LoginButton';

const LP_ADDR = process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS!;
const FP_ADDR = process.env.NEXT_PUBLIC_FEE_POOL_ADDRESS!;
const MA_ADDR = process.env.NEXT_PUBLIC_MANAGER_ADDRESS!;
const MXN_ADDR = process.env.NEXT_PUBLIC_MXN_ADDRESS!;
const USD_ADDR = process.env.NEXT_PUBLIC_USD_ADDRESS!;

const estimatedAPY = 12 * 0.9;

export default function LendPage() {
    const { showToast } = useToast();
    const { ready, authenticated } = usePrivy();
    const { address } = useAccount();
    const [depositAmt, setDepositAmt] = useState("");

    const { data: userBalanceInMXNData, refetch: getUserBalanceMXN, isLoading: isUserBalanceInMXNLoading } = useBalance({
        address,
        token: MXN_ADDR as `0x${string}` | undefined,
    });
    const { data: poolBalanceInMXNData, refetch: getPoolBalanceMXN } = useBalance({
        address: LP_ADDR as `0x${string}`,
        token: MXN_ADDR as `0x${string}` | undefined,
    });

    // Fetch pools info
    const { data: currentTimestamp, refetch: getCurrentTimestamp } = useReadContract({ address: MA_ADDR as `0x${string}`, abi: microloanAbi, functionName: 'getCurrentTimestamp' });
    const { data: lockedInPeriod } = useReadContract({ address: LP_ADDR as `0x${string}`, abi: liquidityPoolAbi, functionName: 'lockedInPeriod' });
    const { data: claimTerm } = useReadContract({ address: FP_ADDR as `0x${string}`, abi: feePoolAbi, functionName: 'claimTerm' });
    const { data: claimableFees, refetch: getClaimableFees, isLoading: isClaimableFeesLoading } = useReadContract({ address: FP_ADDR as `0x${string}`, abi: feePoolAbi, functionName: 'claimableFees' });
    const { data: totalFees, refetch: getTotalFees, isLoading: isTotalFeesLoading } = useReadContract({ address: FP_ADDR as `0x${string}`, abi: feePoolAbi, functionName: 'totalFees' });
    // Fetch user's info
    const { data: totalShares, refetch: getTotalShares, isLoading: isTotalSharesLoading } = useReadContract({ address: LP_ADDR as `0x${string}`, abi: liquidityPoolAbi, functionName: 'totalShares' });
    const { data: userShares, refetch: getUserShares, isLoading: isUserSharesLoading } = useReadContract({ address: LP_ADDR as `0x${string}`, abi: liquidityPoolAbi, functionName: 'shares', args: [address!] });
    const { data: userBalanceTimestamp, refetch: getUserBalanceTimestamp } = useReadContract({ address: LP_ADDR as `0x${string}`, abi: liquidityPoolAbi, functionName: 'balancesTimestamp', args: [address!] });
    const { data: userClaimed, refetch: getUserClaimed, isLoading: isUserClaimedLoading } = useReadContract({ address: FP_ADDR as `0x${string}`, abi: feePoolAbi, functionName: 'claimed', args: [address!] });

    const { data: approveDepositHash, error: approveDepositError, writeContractAsync: approveDeposit, isPending: approveDepositIsPending } = useWriteContract();
    const { data: depositHash, error: depositError, writeContractAsync: deposit, isPending: depositIsPending } = useWriteContract();
    const { isLoading: depositConfirming, isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositHash });

    const { data: claimHash, error: claimError, writeContractAsync: claim, isPending: claimIsPending } = useWriteContract();
    const { isLoading: claimConfirming, isSuccess: claimConfirmed } = useWaitForTransactionReceipt({ hash: claimHash });

    const { data: withdrawHash, writeContractAsync: withdraw, isPending: withdrawIsPending } = useWriteContract();
    const { isLoading: withdrawConfirming, isSuccess: withdrawConfirmed } = useWaitForTransactionReceipt({ hash: withdrawHash });

    const handleWalletConnectClick = (buttonName: string) => {
        trackEvent(
            'wallet_click',      // Action
            'lend',      // Category (page name)
            buttonName        // Label (which button was clicked)
        );
    };
    
    useEffect(() => {
        if (address) {
            getTotalShares();
            getUserShares();
            getUserBalanceMXN();
            getPoolBalanceMXN();
            getClaimableFees();
            getUserClaimed();
            getTotalFees();
            //console.log("onDeposit  depositHash:", depositHash, " depositConfirming:", depositConfirming, " depositConfirmed:", depositConfirmed);
        }
    }, [depositConfirmed, claimConfirmed, withdrawConfirmed, address]);

    const onDeposit = async () => {
        if (!depositAmt || !address) return;
        //setIsLoading(true);
        try {
            getUserShares();
            getUserBalanceMXN();
            let userBalanceInMXN = userBalanceInMXNData?.formatted;
            console.log("onDeposit userBalanceInMXN:", userBalanceInMXN!, " depositAmt:", depositAmt!);

            if (+depositAmt > +userBalanceInMXN!) {
                showToast("You don't have enough MXNe to deposit.", "error");
                console.log("onDeposit You don't have enough MXNe to deposit.");
                return;
            }

            if (userShares! > 0) {
                showToast("You have already deposited funds, for adding more please withdraw all first.", "error")
                console.log("onDeposit You have already deposited funds, for adding more please withdraw all first.");
                return;
            }

            await approveDeposit({
                abi: usdcAbi,// reuse usdcAbi as it has similar functions
                address: MXN_ADDR as `0x${string}`,
                functionName: 'approve',
                args: [LP_ADDR as `0x${string}`, parseUnits(depositAmt, 6)],
            });
            console.log("onDeposit  hashApprove:", approveDepositHash);

            await deposit({
                address: LP_ADDR as `0x${string}`,
                abi: liquidityPoolAbi,
                functionName: 'deposit',
                args: [parseUnits(depositAmt, 6)],
            });
            console.log("onDeposit  depositHash:", depositHash);

            setDepositAmt("");

            showToast("Congrats: Deposit done!", "success");

        } catch (err: any) {
            console.error("onDeposit  Error onDeposit:", err);
            // Extract a string error message from the error object
            const errorStr =
                typeof err === "string"
                    ? err
                    : err?.message || err?.reason || JSON.stringify(err);

            if (errorStr.includes("cancelled transaction")) {
                showToast("You rejected the request, please try again when you are ready to make the payment.", "error");
            } else {
                showToast("An error occurred while processing the deposit. Please try again later.", "error");
            }
        } finally {
            //setIsLoading(false);
        }
    };

    const onClaim = async () => {
        if (!address) return;
        //setIsLoading(true);
        try {
            //require(block.timestamp - userBalanceTimestamp > claimTerm, "Claims are not allowed yet");
            getUserBalanceTimestamp();
            getCurrentTimestamp();
            console.log(" userBalanceTimestamp:", userBalanceTimestamp, " claimTerm:", claimTerm, " currentTimestamp:", currentTimestamp);
            if (currentTimestamp! - userBalanceTimestamp! < claimTerm!) {
                showToast("Claims are not allowed yet", "error");
                console.error("Claims are not allowed yet");
                return;
            }
            getTotalShares();
            getUserShares();
            getClaimableFees();
            getUserClaimed();
            console.log("claimableFees:", claimableFees, " userShares:", userShares, " userClaimed:", userClaimed);
            if ((claimableFees! * userShares!) / totalShares! <= userClaimed!) {
                showToast("Nothing to claim", "error");
                console.error("Nothing to claim");
                return;
            }

            await claim({
                address: FP_ADDR as `0x${string}`,
                abi: feePoolAbi,
                functionName: 'claim'
            });
            console.log("onClaim  claimHash:", claimHash);
            showToast("Congrats: Claim done!", "success");

        } catch (err: any) {
            console.error("Claim Error onClaim:", err);
            // Extract a string error message from the error object
            const errorStr =
                typeof err === "string"
                    ? err
                    : err?.message || err?.reason || JSON.stringify(err);

            if (errorStr.includes("cancelled transaction")) {
                showToast("You rejected the request, please try again when you are ready.", "error");
            } else {
                showToast("An error occurred while processing the claim. Please try again later.", "error");
            }
        } finally {
            //setIsLoading(false);
        }
    };

    const onWithdraw = async () => {
        if (!address) return;
        //setIsLoading(true);
        try {
            getUserBalanceTimestamp();
            getCurrentTimestamp();
            console.log(" userBalanceTimestamp:", userBalanceTimestamp, " lockedInPeriod:", lockedInPeriod, " currentTimestamp:", currentTimestamp);
            if (currentTimestamp! - userBalanceTimestamp! < lockedInPeriod!) {
                showToast("Withdraws are not allowed yet", "error");
                console.error("Withdraws are not allowed yet");
                return;
            }

            getTotalShares();
            getUserShares();
            getClaimableFees();
            getUserClaimed();
            console.log("claimableFees:", claimableFees, " userShares:", userShares, " userClaimed:", userClaimed);
            if ((claimableFees! * userShares!) / totalShares! > userClaimed!) {
                showToast("Please first claim your yield and then do withdrawal!!!", "error");
                console.error("pending claims");
                return;
            }

            if (userShares! > poolBalanceInMXNData!.value) {
                showToast("Not enough MXNe in the pool yet, but we have added you to the waiting list.", "error");
                console.log("onWithdraw Not enough MXNe in the pool yet, but we have added you to the waiting list.");
                return;
            }

            await withdraw({
                address: LP_ADDR as `0x${string}`,
                abi: liquidityPoolAbi,
                functionName: 'withdraw'
            });
            console.log("onWithdraw  withdrawHash:", withdrawHash);
            showToast("Congrats: Withdrawal done!", "success");

        } catch (err: any) {
            console.error("Withdrawal Error onWithdraw:", err);
            // Extract a string error message from the error object
            const errorStr =
                typeof err === "string"
                    ? err
                    : err?.message || err?.reason || JSON.stringify(err);

            if (errorStr.includes("cancelled transaction")) {
                showToast("You rejected the request, please try again when you are ready.", "error");
            } else {
                showToast("An error occurred while processing the withdrawal. Please try again later.", "error");
            }
        } finally {
            //setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
            <h1 className="text-3xl font-bold mt-6 mb-6">Lend Now</h1>
            {ready && authenticated ? (
                <>
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        {/* Loading animation overlay */}
                        {withdrawConfirming && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                <p>Processing withdrawal...</p>
                            </div>
                        )}
                        {/* Stepper UI */}
                        <h2 className="text-2xl font-semibold mb-2">Lending Pool</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <span className="text-[#50e2c3]">Total Deposited</span>
                        <p className="text-xl">{`${Number(totalShares ?? 0) / 1e6} MXNe`}</p>
                        {Number(totalShares) > 0 && (
                            <>
                                <span className="text-[#50e2c3]">Utilization Ratio</span>
                                <p className="text-xl">{`${100 - (100 * Number(poolBalanceInMXNData!.value) / Number(totalShares))}%`}</p>

                            </>
                        )}
                        <span className="text-[#50e2c3]">Your Share</span>
                        <p className="text-xl">{`${Number(userShares ?? 0) / 1e6} MXNe`}</p>
                        <span className="text-[#50e2c3]">APY</span>
                        <p className="text-xl">~{estimatedAPY}%</p>
                        {userShares! > 0 && (
                            <>
                                <Button onClick={onWithdraw} disabled={withdrawIsPending} className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">{withdrawIsPending ? "Withdrawing…" : "Withdraw"}</Button>
                            </>
                        )}

                    </div>

                    {/* Deposit Widget */}
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        {/* Loading animation overlay */}
                        {depositConfirming && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                <p>Processing deposit...</p>
                            </div>
                        )}
                        <h2 className="text-2xl font-semibold mb-2">Deposit MXNe</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <Input
                            type="number"
                            placeholder="Amount in MXNe"
                            value={depositAmt}
                            onChange={e => setDepositAmt(e.target.value)}
                            className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                        />
                        <Button onClick={onDeposit} disabled={approveDepositIsPending || depositIsPending || userShares! > 0} className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">{approveDepositIsPending || depositIsPending ? "Depositing…" : userShares! > 0 ? "Deposit done" : "Deposit"}</Button>
                        <p className="text-sm text-gray-400">(You have {userBalanceInMXNData?.formatted} MXNe)</p>
                    </div>

                    {/* Claim Rewards */}
                    {userShares! > 0 && (
                        <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                            {/* Loading animation overlay */}
                            {claimConfirming && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                    <p>Processing claim...</p>
                                </div>
                            )}
                            <h2 className="text-2xl font-semibold mb-2">Claim Rewards</h2>
                            <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                            <span className="text-[#50e2c3]">Available to Claim</span>
                            <p className="text-xl">{formatUnits(((claimableFees! * userShares!) / totalShares!) - userClaimed!, 6)} MXNe</p>
                            <span className="text-[#50e2c3]">Claimed Yield</span>
                            <p className="text-xl">{formatUnits(userClaimed!, 6)} MXNe</p>
                            <span className="text-[#50e2c3]">Estimated Yield</span>
                            <p className="text-xl">{(Number(claimableFees!) / Number(totalShares!) * 100).toFixed(2)}%</p>
                            <Button onClick={onClaim} disabled={claimIsPending} className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">{claimIsPending ? "Claiming…" : "Claim"}</Button>
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
