"use client"
import { useEffect, useMemo } from "react"
import { useAccount, useConnect, useWriteContract, useReadContract, useWaitForTransactionReceipt, useBalance } from "wagmi"
import { usdcAbi } from "@/lib/usdc-abi";
import { microloanAbi } from "@/lib/microloan-abi";
import { useToast } from "@/components/ui/toastprovider";
import { formatUnits } from 'viem';
import { Button } from "@/components/ui/button";
import { BanknoteX, Loader2 } from "lucide-react";
import { cbWalletConnector } from "@/wagmi";
import { Wallet } from "lucide-react";
import { trackEvent } from '@/lib/analytics';

const LP_ADDR = process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS!;
const MA_ADDR = process.env.NEXT_PUBLIC_MANAGER_ADDRESS!;
const MXN_ADDR = process.env.NEXT_PUBLIC_MXN_ADDRESS!;
const USD_ADDR = process.env.NEXT_PUBLIC_USD_ADDRESS!;

interface Loan {
    collateral: bigint;
    principal: bigint;
    fee: bigint;
    startTime: bigint;
    term: bigint;// in seconds
    termInPeriods: bigint;// 1 to 6
    pendingPayments: bigint;// 6 to 0, in periods
    paid: bigint;// amount repaid
    liquidated: bigint;// # of liquidations
    active: boolean;
}

export default function BorrowPage() {
    const { showToast } = useToast();
    const { connect } = useConnect();
    const { address } = useAccount();

    const { data: userBalanceInMXNData, refetch: getUserBalanceMXN } = useBalance({
        address,
        token: MXN_ADDR as `0x${string}` | undefined,
    });
    const { data: poolBalanceInMXNData, refetch: getPoolBalanceMXN } = useBalance({
        address: LP_ADDR as `0x${string}`,
        token: MXN_ADDR as `0x${string}` | undefined,
    });

    // Fetch user's loan info
    const { data: rawLoanData, refetch: getUserLoan, isLoading: isLoanLoading, isError: isLoanError } = useReadContract({
        address: MA_ADDR as `0x${string}`,
        abi: microloanAbi,
        functionName: 'loans',
        args: [address!],
        query: {
            enabled: !!address,
            staleTime: 30000, // Only refresh data after 30 seconds
            refetchOnWindowFocus: false, // Don't refetch when window regains focus
            refetchInterval: 60000 // Refresh every minute at most
        }
    });

    // Transform the raw data from contract (likely an array) into our Loan interface
    const loan: Loan | undefined = rawLoanData ? {
        collateral: (rawLoanData as any)[0] || BigInt(0),
        principal: (rawLoanData as any)[1] || BigInt(0),
        fee: (rawLoanData as any)[2] || BigInt(0),
        startTime: (rawLoanData as any)[3] || BigInt(0),
        term: (rawLoanData as any)[4] || BigInt(0),
        termInPeriods: (rawLoanData as any)[5] || BigInt(0),
        pendingPayments: (rawLoanData as any)[6] || BigInt(0),
        paid: (rawLoanData as any)[7] || BigInt(0),
        liquidated: (rawLoanData as any)[8] || BigInt(0),
        active: (rawLoanData as any)[9] || false
    } : undefined;

    const handleWalletConnectClick = (buttonName: string) => {
        trackEvent(
            'wallet_click',      // Action
            'borrow',      // Category (page name)
            buttonName        // Label (which button was clicked)
        );
    };

    // Log only when rawLoanData changes, not on every render
    useEffect(() => {
        if (rawLoanData) {
            //console.log("Raw loan data:", rawLoanData);
            //console.log("Parsed loan:", loan);
        }
    }, [rawLoanData]);

    // Fetch user's collateral info
    const { data: userCollateralData, refetch: getUserCollateral, isLoading: isCollateralLoading, isError: isCollateralError } = useReadContract({
        address: MA_ADDR as `0x${string}`,
        abi: microloanAbi,
        functionName: 'collateral',
        args: [address!],
        query: {
            enabled: !!address && !!loan && loan.active,
            staleTime: 30000,
            refetchOnWindowFocus: false,
            refetchInterval: 60000
        }
    });
    const userCollateral = userCollateralData as bigint | undefined;

    // Calculate values only once per render using useMemo
    const pct = useMemo(() => loan ? Number(loan.paid) / Number(loan.principal) * 100 : 0, [loan]);
    const nextDue = useMemo(() => loan && loan.termInPeriods > 0 ? Number(loan.startTime) + Number(loan.term / loan.termInPeriods) * (1 + Number(loan.termInPeriods - loan.pendingPayments)) : 0, [loan]);
    const minPayment = useMemo(() => loan && loan.pendingPayments > BigInt(0) ? (loan.principal - loan.paid) / loan.pendingPayments : BigInt(0), [loan]);

    // Hooks for repay functionality - MUST be called unconditionally
    const { data: approveRepayHash, error: approveRepayError, writeContractAsync: approveRepay, isPending: approveRepayIsPending } = useWriteContract();
    const { data: repayHash, error: repayError, writeContractAsync: repay, isPending: repayIsPending } = useWriteContract();
    const { isLoading: repayConfirming, isSuccess: repayConfirmed } = useWaitForTransactionReceipt({ hash: repayHash });

    // Hooks for withdraw functionality - MUST be called unconditionally
    const { data: withdrawHash, writeContractAsync: withdraw, isPending: withdrawIsPending } = useWriteContract();
    const { isLoading: withdrawConfirming, isSuccess: withdrawConfirmed } = useWaitForTransactionReceipt({ hash: withdrawHash });

    useEffect(() => {
        if (address) {
            getUserLoan();
            getUserCollateral();
            getUserBalanceMXN();
        }
    }, [repayConfirmed, withdrawConfirmed, address]);

    if (!address) {
        return (
            <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
                <h1 className="text-3xl font-bold mt-6 mb-6">Borrow Details</h1>
                <div className="mt-8">
                    <p className="text-lg text-gray-500">
                        Please connect your wallet to view loan details.
                    </p>
                    <Button
                        onClick={() => {
                            connect({ connector: cbWalletConnector });
                            handleWalletConnectClick('wallet_connect');
                        }}
                        variant="gradient"
                        size="xl"
                        className="flex items-center mx-auto py-2 px-4 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                    >
                        <Wallet className="h-4 w-4 text-[#50e2c3] hover:text-gray-900" />
                        Get Started
                    </Button>
                </div>
            </div>

        );
    }

    if (isLoanLoading) {
        return (
            <div className="text-center mt-20 py-20 space-y-4 flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-[#50e2c3] mb-4" />
                <p>Loading loan details...</p>
            </div>
        );
    }

    if (isLoanError) {
        return (
            <div className="text-center mt-20 py-20 space-y-4">
                <BanknoteX className="h-20 w-20 text-red-500 mx-auto mb-4" />
                <p>Error fetching loan details. Please try again later.</p>
            </div>
        );
    }

    const onRepay = async () => {
        if (!address) return;
        try {
            getUserBalanceMXN();
            let userBalanceInMXN = userBalanceInMXNData?.value;
            console.log("onRepay userBalanceInMXN:", userBalanceInMXN!, " minPayment:", minPayment!);

            if (minPayment > userBalanceInMXN!) {
                showToast("You don't have enough MXNb to make repayment.", "error");
                console.log("onRepay You don't have enough MXNb to deposit.");
                return;
            }

            await approveRepay({
                abi: usdcAbi, // reuse usdcAbi as it has similar functions
                address: MXN_ADDR as `0x${string}`,
                functionName: 'approve',
                args: [LP_ADDR as `0x${string}`, minPayment],
            });
            console.log("onRepay  approveRepayHash:", approveRepayHash);

            await repay({
                address: MA_ADDR as `0x${string}`,
                abi: microloanAbi,
                functionName: 'repay',
                args: [minPayment],
            });
            console.log("onRepay  repayHash:", repayHash);

            showToast("Congrats: Repayment done!", "success");

        } catch (err: any) {
            console.error("onRepay  Error onRepay:", err);
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

    const onWithdraw = async () => {
        if (!address) return;
        try {
            await withdraw({
                address: MA_ADDR as `0x${string}`,
                abi: microloanAbi,
                functionName: 'withdrawCollateral'
            });
            console.log("onWithdraw  withdrawHash:", withdrawHash);
            showToast("Congrats: Withdrawal done!", "error");

        } catch (err: any) {
            console.error("Withdrawal Error onWithdraw:", err);
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

    return (
        <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
            <h1 className="text-3xl font-bold mt-6 mb-6">Borrow Details</h1>

            {!address ? (
                <div className="text-center mt-20 py-20 space-y-4">
                    <p>Please connect your wallet to view loan details.</p>
                    <Button
                        onClick={() => {
                            connect({ connector: cbWalletConnector });
                            handleWalletConnectClick('wallet_connect');
                        }}
                        variant="gradient"
                        size="xl"
                        className="flex items-center py-2 px-4 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                    >
                        <Wallet className="h-4 w-4 text-[#50e2c3] hover:text-gray-900" />
                        Get Started
                    </Button>
                </div>
            ) : isLoanLoading ? (
                <div className="text-center mt-20 py-20 space-y-4 flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-[#50e2c3] mb-4" />
                    <p>Loading loan details...</p>
                </div>
            ) : isLoanError ? (
                <div className="text-center mt-20 py-20 space-y-4">
                    <BanknoteX className="h-20 w-20 text-red-500 mx-auto mb-4" />
                    <p>Error fetching loan details. Please try again later.</p>
                </div>
            ) : !loan || !loan.active ? (

                <div className="w-full max-w-md mx-auto text-center py-10 space-y-6">

                    {poolBalanceInMXNData && (
                        <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                            <h2 className="text-2xl font-semibold mb-2">Borrowing Pool</h2>
                            <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                            <span className="text-[#50e2c3]">Available to Borrow</span>
                            <p className="text-xl">{poolBalanceInMXNData!.formatted} MXNb</p>
                        </div>
                    )}
                    {Number(userCollateral) > 0 && (
                        <div className="w-full max-w-md mx-auto mt-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                            {withdrawConfirming && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                    <p>Processing withdrawal...</p>
                                </div>
                            )}
                            <h2 className="text-2xl font-semibold mb-2">Collateral</h2>
                            <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                            <span className="text-[#50e2c3]">Locked Amount</span>
                            <p className="text-xl">{(Number(userCollateral) / 1e6).toFixed(2)} USDC</p>
                            <Button
                                onClick={onWithdraw}
                                disabled={withdrawIsPending || withdrawConfirming}
                                className="mt-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                            >
                                {withdrawIsPending || withdrawConfirming ? "Withdrawing…" : "Withdraw"}
                            </Button>

                        </div>
                    )}
                    <BanknoteX className="h-20 w-20 text-[#50e2c3] mx-auto mt-6" />
                    <p>You have no active loan</p>
                    <a href="/pay" className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Start a new purchase</a>


                </div>
            ) : (
                <>
                    {/* Loan Card */}
                    <div className="w-full max-w-md mx-auto mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        {repayConfirming && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                <p>Processing repayment...</p>
                            </div>
                        )}
                        <h2 className="text-2xl font-semibold mb-2">Loan Details</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />

                        <div className="flex justify-between items-center">
                            <span className="font-bold">Total borrowed</span>
                            <span className="text-xl">{Number(loan.principal) / 1e6} MXNb</span>
                        </div>
                        <div className="mt-4 h-2 bg-gray-700 rounded overflow-hidden">
                            <div style={{ width: `${pct}%` }}
                                className="h-full bg-[#50e2c3]" />
                        </div>
                        <p className="mt-2 text-sm">{Math.floor(pct)}% repaid ({formatUnits(loan.paid, 6)} MXNb)</p>
                    </div>

                    {/* Repayment Schedule */}
                    <div className="w-full max-w-md mx-auto mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 relative">
                        <h2 className="text-2xl font-semibold mb-2 text-center">Repayment Schedule</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />

                        <table className="w-full text-left">
                            <thead><tr>
                                <th>Suggested Due Date</th><th>Amount</th><th>Status</th>
                            </tr></thead>
                            <tbody>
                                {loan && [...Array(Number(loan.termInPeriods)).keys()].map(i => {
                                    const dueDate = Number(loan.startTime) + ((i + 1) * (Number(loan.term) / Number(loan.termInPeriods)))
                                    const paid = (i + 1) <= (Number(loan.termInPeriods) - Number(loan.pendingPayments))
                                    return (
                                        <tr key={i}>
                                            <td>{new Date(dueDate * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                            <td>{(Number(loan.principal) / 1e6 / Number(loan.termInPeriods)).toFixed(2)} MXNb</td>
                                            <td>{paid ? "✅ Paid" : (i + 1 === (Number(loan.termInPeriods) - Number(loan.pendingPayments)))
                                                ? `Due in ${Math.ceil((dueDate * 1000 - Date.now()) / 86400000)}d`
                                                : "Pending"}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Next Payment & Repay */}
                    <div className="w-full max-w-md mx-auto mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 relative">
                        <h2 className="text-2xl font-semibold mb-2 text-center">Next Payment</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />

                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-[#50e2c3]">Due Date</span>
                                <p>{new Date(nextDue * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                <span className="text-[#50e2c3] mt-2 block">Amount</span>
                                <p className="font-bold text-xl">{(Number(minPayment) / 1e6).toFixed(2)} MXNb</p>
                            </div>
                            <div className="flex flex-col items-center space-y-4">
                                <Button
                                    onClick={onRepay}
                                    disabled={approveRepayIsPending || repayIsPending || !loan.active}
                                    className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full px-6 py-3"
                                >
                                    {approveRepayIsPending || repayIsPending ? "Repaying…" : "Repay"}
                                </Button>
                                <p className="text-sm text-gray-400">(You have {userBalanceInMXNData?.formatted} MXNb)</p>
                            </div>

                        </div>
                    </div>

                    {/* Collateral Section */}
                    {isCollateralLoading ? (
                        <div className="w-full max-w-md mx-auto mb-6 p-8 border border-[#264C73] rounded-lg text-center space-y-4">
                            <h2 className="text-2xl font-semibold mb-2">Collateral</h2>
                            <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                            <Loader2 className="h-8 w-8 animate-spin text-[#50e2c3] mx-auto mb-2" />
                            <p>Loading collateral information...</p>
                        </div>
                    ) : isCollateralError ? (
                        <div className="w-full max-w-md mx-auto mb-6 p-8 border border-[#264C73] rounded-lg text-center">
                            <h2 className="text-2xl font-semibold mb-2">Collateral</h2>
                            <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                            <p className="text-red-500">Could not load collateral information.</p>
                        </div>
                    ) : userCollateral && Number(userCollateral) > 0 && (
                        <div className="w-full max-w-md mx-auto mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                            {withdrawConfirming && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                    <p>Processing withdrawal...</p>
                                </div>
                            )}
                            <h2 className="text-2xl font-semibold mb-2">Collateral</h2>
                            <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                            <span className="text-[#50e2c3]">Locked Amount</span>
                            <p className="text-xl">{(Number(userCollateral) / 1e6).toFixed(2)} USDC</p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
