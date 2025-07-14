"use client";

import { useState, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useBalance, useReadContract } from "wagmi";
import { useToast } from "@/components/ui/toastprovider";
import { usdcAbi } from "@/lib/usdc-abi";
import { microloanAbi } from "@/lib/microloan-abi";
import { useWriteContracts } from 'wagmi/experimental';
import { parseUnits, formatUnits } from 'viem';
import { Wallet } from "lucide-react";
import { trackEvent } from '@/lib/analytics';
//import chainlinkUsdMxnAbi from '@/lib/chainlink-usd-mxn-abi.json';

import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from '@/components/LoginButton';

const rate = Number(process.env.NEXT_PUBLIC_RAPIMONI_FEE) / 100; // Fee rate charged per payment
const rapiMoniAddress = process.env.NEXT_PUBLIC_RAPIMONI_WALLET; // wallet address for collecting fees
const COLLATERAL_RATIO = 1.2; // collateral should be 120% of the product price
const USD_MXN_FEED = process.env.NEXT_PUBLIC_CHAINLINK_USD_MXN_FEED!;

const USD_ADDR = process.env.NEXT_PUBLIC_USD_ADDRESS; // Testnet
const MXN_ADDR = process.env.NEXT_PUBLIC_MXN_ADDRESS; // Testnet
const BRZ_ADDR = process.env.NEXT_PUBLIC_BRZ_ADDRESS; // Testnet
const MA_ADDR = process.env.NEXT_PUBLIC_MANAGER_ADDRESS!;
const LP_ADDR = process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS!;
//const mockMerchantAddress = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;

/*function useUsdMxnRate() {
    const { data: roundData } = useReadContract({
        address: USD_MXN_FEED,
        abi: chainlinkUsdMxnAbi,
        functionName: 'latestRoundData',
        // @ts-ignore
        config: { cacheTime: 300_000 } // Cache for 5 minutes
    });
    // price is in 8 decimals
    const price = roundData ? Number((roundData as any[])[1]) / 1e8 : 0;
    return price;
}*/

// Helper to get token decimals (defaulting to 6 for USDC, MXN etc.)
const getTokenDecimals = (tokenSymbol: string) => {
    return 6;
};

export default function PayPage() {
    const { showToast } = useToast();
    const { address } = useAccount();
    //const { connect } = useConnect();
    const { ready, authenticated } = usePrivy();
    const fxRate = 19.48;//useUsdMxnRate(); 1 USD is X MXN
    const { writeContractsAsync } = useWriteContracts();
    const { writeContractAsync } = useWriteContract();
    const [payload, setPayload] = useState<{
        merchant: string;
        description: string;
        amount: string;
        token: string;
        allowFallback: boolean;
        enableBNPL: boolean;
        loanTerm: string; // Ensure loanTerm is part of the payload if BNPL is enabled
    } | null>(null);
    const [step, setStep] = useState<"init" | "scan" | "decide" | "confirm" | "done">("init");
    const [quote, setQuote] = useState<string>(""); // USD amount for fallback
    const [txHash, setTxHash] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isBnplPaymentDone, setIsBnplPaymentDone] = useState<boolean>(false);

    // Helper to resolve token address
    const getTokenAddress = (token: string) => {
        switch (token?.toLowerCase()) {
            case "mxn": return MXN_ADDR!;
            default: return USD_ADDR!;
        }
    };

    const merchantTokenAddress = payload ? getTokenAddress(payload.token) : undefined;
    const merchantTokenDecimals = payload ? getTokenDecimals(payload.token) : 6;
    const usdDecimals = 6; // USDC decimals

    const { data: userBalanceInMerchantsTokenData, refetch: getUserBalanceMerchantsToken } = useBalance({
        address,
        token: merchantTokenAddress as `0x${string}` | undefined,
    });
    const { data: userBalanceInUSDData, refetch: getUserBalanceUSD } = useBalance({
        address,
        token: USD_ADDR as `0x${string}` | undefined,
    });
    const { data: poolBalanceInMXNData, refetch: getPoolBalanceMXN } = useBalance({
        address: LP_ADDR as `0x${string}`,
        token: MXN_ADDR as `0x${string}` | undefined,
    });

    // BNPL related hooks
    const { data: approveCollateralHash, error: approveCollateralError, writeContractAsync: approveCollateral, isPending: approveCollateralIsPending } = useWriteContract();
    const { isLoading: approveCollateralConfirming, isSuccess: approveCollateralConfirmed } = useWaitForTransactionReceipt({ hash: approveCollateralHash });

    const { data: openLoanHash, error: openLoanError, writeContractAsync: openLoan, isPending: openLoanIsPending } = useWriteContract();
    const { isLoading: openLoanConfirming, isSuccess: openLoanConfirmed } = useWaitForTransactionReceipt({ hash: openLoanHash });

    const handleWalletConnectClick = (buttonName: string) => {
        trackEvent(
            'wallet_click',      // Action
            'pay',      // Category (page name)
            buttonName        // Label (which button was clicked)
        );
    };

    // Load payload from URL if present
    useEffect(() => {
        if (typeof window !== "undefined" && !payload) {
            const params = new URLSearchParams(window.location.search);
            const data = params.get("data");
            if (data) {
                try {
                    const parsed = JSON.parse(decodeURIComponent(data));
                    setPayload(parsed);
                    getUserBalanceMerchantsToken();
                    getUserBalanceUSD();
                    setStep("decide");
                } catch (e) {
                    setPayload(null);
                    showToast("Invalid payment data in URL.", "error");
                }
            }
        }
    }, [payload, getUserBalanceMerchantsToken, getUserBalanceUSD]);

    // QR decoded
    const handleScan = (detectedCodes: { rawValue: string }[]) => {
        if (detectedCodes.length > 0) {
            const code = detectedCodes[0].rawValue;
            if (code) {
                try {
                    const parsedPayload = JSON.parse(code);
                    setPayload(parsedPayload);
                    getUserBalanceMerchantsToken();
                    getUserBalanceUSD();
                    setStep("decide");
                } catch (e) {
                    showToast("Invalid QR Code", "error");
                    setStep("scan");
                }
            }
        }
    };

    const handleError = (err: any, currentStep: "decide" | "scan" = "decide") => {
        console.error("Payment Error:", err);
        const errorStr = typeof err === "string" ? err : err?.message || err?.reason || JSON.stringify(err);
        if (errorStr.includes("no valid median")) {
            showToast(`The oracle for the ${payload?.token.toUpperCase()}/USD pair is temporarily not working. Please try again later or use another currency.`, "error");
        } else if (errorStr.includes("cancelled transaction") || errorStr.includes("rejected the request")) {
            showToast("You rejected the request. Please try again when you are ready.", "error");
        } else {
            showToast("An error occurred while processing the payment. Please try again later.", "error");
        }
        setStep(payload ? currentStep : "scan");
        setIsLoading(false);
    };

    // 1. Pay directly with Merchant's Token
    const handlePayDirectWithMerchantToken = async () => {
        if (!payload || !address || !merchantTokenAddress) return;
        setIsLoading(true);
        const { amount, merchant } = payload;
        const amountInSmallestUnit = parseUnits(amount, 6);
        const fee = parseUnits(`${Number(amount) * rate}`, 6); // fee in smallest unit
        const amountToMerchant = amountInSmallestUnit - fee;
        //console.log("handlePayDirectWithMerchantToken fee:",fee," amountToMerchant:",amountToMerchant)

        try {
            const hashPay = await writeContractAsync({
                abi: usdcAbi,
                address: merchantTokenAddress as `0x${string}`,
                functionName: 'transfer',
                args: [merchant as `0x${string}`, amountToMerchant],
            });
            const hashPayRm = await writeContractAsync({
                abi: usdcAbi,
                address: merchantTokenAddress as `0x${string}`,
                functionName: 'transfer',
                args: [rapiMoniAddress! as `0x${string}`, fee],
            });
            setTxHash(hashPay);
            setStep("done");
            setIsBnplPaymentDone(false);
            showToast("Successful payment!", "success");
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Initiate USD Fallback Payment (sets quote and moves to confirm step)
    const handleInitiateUSDFallbackPayment = async () => {
        if (!payload || !fxRate) return;
        setIsLoading(true);
        const { amount, token } = payload;
        const amountInUSD = token.toLowerCase() === 'usd' ? Number(amount) : Number(amount) / fxRate;

        if (isNaN(amountInUSD) || amountInUSD <= 0) {
            showToast("Could not determine USD equivalent. Oracle might be unavailable.", "error");
            setIsLoading(false);
            return;
        }
        const quoteUSD = amountInUSD.toFixed(usdDecimals); // Ensure quote has correct decimals
        setQuote(quoteUSD);
        setStep("confirm");
        showToast(`Not enough ${token.toUpperCase()}. You can pay with ${quoteUSD} USD.`, "info");
        setIsLoading(false);
    };

    // Execute Confirmed USD Payment
    const handleExecuteConfirmedUSDPayment = async () => {
        if (!payload || !address || !quote) return;
        setIsLoading(true);
        const { merchant } = payload;
        const usdAmountInSmallestUnit = parseUnits(quote, usdDecimals);
        const feeInUSD = parseUnits(`${Number(quote) * rate}`, usdDecimals);
        const amountToMerchantUSD = usdAmountInSmallestUnit - feeInUSD;
        //console.log("handleExecuteConfirmedUSDPayment fee:",feeInUSD," amountToMerchant:",amountToMerchantUSD)

        try {
            const hashApprove = await writeContractAsync({
                address: USD_ADDR as `0x${string}`,
                abi: usdcAbi,
                functionName: 'transfer',
                args: [merchant as `0x${string}`, amountToMerchantUSD],
            });
            const hashPay = await writeContractAsync({
                abi: usdcAbi,
                address: USD_ADDR as `0x${string}`,
                functionName: 'transfer',
                args: [rapiMoniAddress! as `0x${string}`, feeInUSD],
            });
            setTxHash(hashPay);
            setStep("done");
            setIsBnplPaymentDone(false);
            showToast("Payment with USD successful!", "success");
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Pay with BNPL
    const handlePayWithBNPL = async () => {
        if (!payload || !address || !fxRate || !payload.loanTerm) {
            showToast("BNPL requirements not met (e.g., loan term missing or exchange rate unavailable).", "error");
            return;
        }
        setIsLoading(true);
        const { amount, token, loanTerm, merchant } = payload;

        // Calculate amounts for BNPL
        const priceInMerchantToken = parseFloat(amount);
        // Convert merchant token amount to USD for collateral
        const priceInUSD = token.toLowerCase() === 'usd' ? priceInMerchantToken : priceInMerchantToken / fxRate;
        if (isNaN(priceInUSD) || priceInUSD <= 0) {
            showToast("Could not determine USD equivalent for BNPL. Oracle might be unavailable.", "error");
            setIsLoading(false);
            return;
        }

        const collateralAmountUSD = priceInUSD * COLLATERAL_RATIO;
        const loanAmountMerchantToken = priceInMerchantToken;

        try {
            // Step 1: Approve collateral
            showToast("Please approve USDC collateral for your loan...", "info");
            await approveCollateral({
                abi: usdcAbi,
                address: USD_ADDR as `0x${string}`,
                functionName: 'approve',
                args: [MA_ADDR as `0x${string}`, parseUnits(collateralAmountUSD.toFixed(usdDecimals), usdDecimals)],
            });
            // The useEffect for approveCollateralConfirmed will trigger the next step
        } catch (err) {
            handleError(err);
        }
        // isLoading will be managed by isPending and confirming hooks
    };

    // Effect for BNPL Step 1: Collateral Approval success
    useEffect(() => {
        if (approveCollateralConfirmed && payload && approveCollateralHash && fxRate) {
            showToast("Collateral approved! Now opening loan...", "success");
            const { amount, token, loanTerm, merchant } = payload;
            const priceInMerchantToken = parseFloat(amount);
            const loanAmountMerchantToken = priceInMerchantToken;
            const collateralAmountUSD = (token.toLowerCase() === 'usd' ? priceInMerchantToken : priceInMerchantToken / fxRate) * COLLATERAL_RATIO;

            openLoan({
                address: MA_ADDR as `0x${string}`,
                abi: microloanAbi,
                functionName: 'openLoan',
                args: [
                    parseUnits(collateralAmountUSD.toFixed(usdDecimals), usdDecimals), // Collateral in USD (smallest unit)
                    parseUnits(loanAmountMerchantToken.toFixed(merchantTokenDecimals), merchantTokenDecimals), // Loan amount in Merchant Token (smallest unit)
                    BigInt(loanTerm), // Loan term (e.g., in days, ensure it's a whole number) switched from uint256 to uint8
                    merchant as `0x${string}` // Merchant address to pay
                ],
            }).catch(err => {
                handleError(err); // Handle error if openLoan call itself fails immediately
                setIsLoading(false);
            });
        }
    }, [approveCollateralConfirmed, payload, approveCollateralHash, openLoan, fxRate, MA_ADDR, merchantTokenDecimals, usdDecimals]);

    // Effect for BNPL Step 2: Open Loan success
    useEffect(() => {
        if (openLoanConfirmed && openLoanHash) {
            setTxHash(openLoanHash); // Using openLoanHash as the tx indicator for BNPL
            setStep("done");
            setIsBnplPaymentDone(true);
            showToast("BNPL: Loan opened and payment to merchant successful!", "success");
            setIsLoading(false);
        }
    }, [openLoanConfirmed, openLoanHash]);

    // Effect for BNPL errors
    useEffect(() => {
        if (approveCollateralError) {
            handleError(approveCollateralError);
            setIsLoading(false); // Ensure loading is stopped
        }
        if (openLoanError) {
            handleError(openLoanError);
            setIsLoading(false); // Ensure loading is stopped
        }
    }, [approveCollateralError, openLoanError]);

    // Derived states for UI logic
    const canPayWithMerchantToken = payload && userBalanceInMerchantsTokenData && userBalanceInMerchantsTokenData.value >= parseUnits(payload.amount, merchantTokenDecimals);

    const merchantAmountInUSD = payload && fxRate > 0 ? (payload.token.toLowerCase() === 'usd' ? parseFloat(payload.amount) : parseFloat(payload.amount) / fxRate) : 0;

    const canPayWithUSD = payload && userBalanceInUSDData && fxRate > 0 && payload.allowFallback &&
        userBalanceInUSDData.value >= parseUnits(merchantAmountInUSD.toFixed(usdDecimals), usdDecimals);

    const requiredCollateralForBNPL_USD = merchantAmountInUSD * COLLATERAL_RATIO;

    const canPayWithBNPL = payload && payload.enableBNPL && userBalanceInUSDData && poolBalanceInMXNData && fxRate > 0 && payload.loanTerm &&
        userBalanceInUSDData.value >= parseUnits(requiredCollateralForBNPL_USD.toFixed(usdDecimals), usdDecimals) && poolBalanceInMXNData.value >= parseUnits(payload.amount, usdDecimals);

    // Combined loading state
    const isProcessing = isLoading || approveCollateralIsPending || approveCollateralConfirming || openLoanIsPending || openLoanConfirming;

    return (
        <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
            <h1 className="text-3xl font-bold mt-6 mb-6">Pay Now</h1>
            {ready && authenticated ? (
                <>
                    <div className="w-full max-w-md mx-auto p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        {isProcessing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-10 rounded-lg">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                <p>{approveCollateralIsPending || approveCollateralConfirming ? "Approving Collateral..." : openLoanIsPending || openLoanConfirming ? "Opening Loan..." : "Processing..."}</p>
                            </div>
                        )}
                        <h2 className="text-2xl font-semibold mb-2">Payment Flow</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <div className="flex justify-between items-center mb-6">
                            <div className={`flex-1 text-xs ${step === "scan" || step === "init" ? "text-[#50e2c3]" : "text-gray-400"}`}>Scan</div>
                            <div className="w-4 h-0.5 bg-gray-600 mx-1" />
                            <div className={`flex-1 text-xs ${step === "decide" ? "text-[#50e2c3]" : "text-gray-400"}`}>Choose path</div>
                            <div className="w-4 h-0.5 bg-gray-600 mx-1" />
                            <div className={`flex-1 text-xs ${step === "confirm" ? "text-[#50e2c3]" : "text-gray-400"}`}>Confirm USD</div>
                            <div className="w-4 h-0.5 bg-gray-600 mx-1" />
                            <div className={`flex-1 text-xs ${step === "done" ? "text-[#50e2c3]" : "text-gray-400"}`}>Receipt</div>
                        </div>

                        {step === "init" && (
                            <>
                                <br /><span className="text-sm text-[#50e2c3]">(You will need testnet ETH and supported tokens. Please, get them from a faucet.)</span>
                                <br /><Button onClick={() => setStep("scan")} disabled={isProcessing} className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Scan to Pay</Button>
                            </>
                        )}

                        {step === "decide" && payload && (
                            <>
                                <p className="mb-4">
                                    You are paying <strong>{payload.amount} {payload.token.toUpperCase()}</strong>
                                    {payload.description ? ` for ${payload.description}` : ""}.
                                    <br />
                                    <span className="text-sm">Your {payload.token.toUpperCase()} balance: {userBalanceInMerchantsTokenData ? formatUnits(userBalanceInMerchantsTokenData.value, merchantTokenDecimals) : 'Loading...'}</span>
                                    <br />
                                    <span className="text-sm">Your USD balance: {userBalanceInUSDData ? formatUnits(userBalanceInUSDData.value, usdDecimals) : 'Loading...'}</span>
                                    {fxRate > 0 && payload.token.toLowerCase() !== 'usd' && <span className="text-xs block text-gray-400">(1 USD ≈ {fxRate.toFixed(4)} {payload.token.toUpperCase()})</span>}
                                    {fxRate > 0 && payload.token.toLowerCase() === 'usd' && <span className="text-xs block text-gray-400">(Current Rate: 1 USD ≈ {(1 / fxRate).toFixed(4)} MXN - for non-USD merchant tokens)</span>}


                                </p>

                                {canPayWithMerchantToken && (
                                    <Button onClick={handlePayDirectWithMerchantToken} disabled={isProcessing} className="w-full mb-3 bg-green-500 hover:bg-green-600 text-white rounded-full">
                                        {`Pay ${payload.amount} ${payload.token.toUpperCase()} Directly`}
                                    </Button>
                                )}

                                {canPayWithUSD && !canPayWithMerchantToken && (
                                    <Button onClick={handleInitiateUSDFallbackPayment} disabled={isProcessing} className="w-full mb-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full">
                                        {`Pay with USD (≈ ${(parseFloat(payload.amount) / fxRate).toFixed(2)} USD)`}
                                    </Button>
                                )}

                                {canPayWithBNPL && (
                                    <>
                                        <Button onClick={handlePayWithBNPL} disabled={isProcessing || !payload.loanTerm} className="w-full mb-3 bg-purple-500 hover:bg-purple-600 text-white rounded-full">
                                            Pay with BNPL Loan*
                                        </Button>
                                        <span className="text-xs block text-gray-400"><strong>*Terms:</strong> Zero interest, {payload.loanTerm} monthly payments. Requires ≈ {requiredCollateralForBNPL_USD.toFixed(2)} USDC as collateral. Instant approval. No credit score needed.</span>
                                    </>

                                )}

                                {!canPayWithMerchantToken && !canPayWithUSD && !canPayWithBNPL && (
                                    <div className="mt-4 p-3 bg-red-900 bg-opacity-50 rounded-md">
                                        <p className="text-yellow-300 text-sm">
                                            Insufficient balance for direct payment.
                                            {!payload.allowFallback && ` USD fallback is not allowed by merchant.`}
                                            {!payload.enableBNPL && ` BNPL is not enabled.`}
                                            {fxRate <= 0 && (payload.allowFallback || payload.enableBNPL) && ` Exchange rate unavailable for USD options.`}
                                        </p>
                                        <p className="text-gray-300 text-xs mt-1">
                                            Please ensure you have enough {payload.token.toUpperCase()}
                                            {payload.allowFallback || payload.enableBNPL ? " or sufficient USD for fallback/collateral." : "."}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {step === "confirm" && payload && quote && (
                            <>
                                <p>
                                    You'll pay <strong>{quote} USD</strong> (for {payload.amount} {payload.token.toUpperCase()}) from your wallet.
                                    {fxRate > 0 && (
                                        <>
                                            <br /><span className="text-xs text-[#50e2c3]">(Rate: 1 USD ≈ {(Number(payload.amount) / Number(quote)).toFixed(2)} {payload.token.toUpperCase()})</span>
                                        </>
                                    )}
                                </p>
                                <Button onClick={handleExecuteConfirmedUSDPayment} disabled={isProcessing} className="mt-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Confirm & Pay with USD</Button>
                            </>
                        )}

                        {step === "done" && txHash && payload && (
                            <>
                                <p className="text-xl mb-4">🎉 <span className="text-[#50e2c3]">Payment Complete!</span> 🎉</p>
                                {isBnplPaymentDone ? (
                                    <p>
                                        You've successfully initiated a "Buy Now, Pay Later" for <strong>{payload.amount} {payload.token.toUpperCase()}</strong>.
                                        <br />The amount has been paid to the merchant.
                                    </p>
                                ) : quote ? (
                                    <p>
                                        You paid <strong>{quote} USD</strong> (equivalent to {payload.amount} {payload.token.toUpperCase()}) to the merchant!
                                    </p>
                                ) : (
                                    <p>
                                        You paid <strong>{payload.amount} {payload.token.toUpperCase()}</strong> to the merchant!
                                    </p>
                                )}
                                <p className="mt-2 text-xs">Transaction Hash: <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#50e2c3]">{txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}</a></p>
                                <Button onClick={() => { setStep("init"); setPayload(null); setTxHash(""); setQuote(""); setIsBnplPaymentDone(false); }} disabled={isProcessing} className="mt-6 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">New Payment</Button>
                            </>
                        )}

                        {step === "scan" && !payload && (
                            <Scanner
                                onScan={(result) => handleScan(result)}
                                onError={(error) => {
                                    console.error("QR Scanner Error:", error);
                                    showToast("QR Scanner error. Please try again or ensure camera permissions.", "error");
                                    setStep("init");
                                }}
                            />
                        )}
                    </div>
                </>
            ) : (
                <div className="mt-8">
                    <p className="text-lg text-gray-500">
                        Please sign in to scan the QR code or to open the link, and pay.
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
    );
}
