"use client";

import { useState, useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAccount, useConnect } from "wagmi";
import { useToast } from "@/components/ui/toastprovider";
import { Wallet } from "lucide-react";
import { trackEvent } from '@/lib/analytics';
import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from '@/components/LoginButton';

const USDTokenAddress = process.env.NEXT_PUBLIC_USD_ADDRESS; // Testnet
const MXNTokenAddress = process.env.NEXT_PUBLIC_MXN_ADDRESS; // Testnet
const BRZTokenAddress = process.env.NEXT_PUBLIC_BRZ_ADDRESS; // Testnet
const rate = Number(process.env.NEXT_PUBLIC_RAPIMONI_FEE); // Fee rate charged bu RapiMoni per payment

export default function ChargePage() {
    const [mounted, setMounted] = useState(false);
    //const { connect } = useConnect();
    const { ready, authenticated } = usePrivy();
    const { address } = useAccount();
    const [amount, setAmount] = useState("");
    const [token, setToken] = useState("mxn");
    const [description, setDescription] = useState("");
    const [allowFallback, setAllowFallback] = useState(false);
    const [quote, setQuote] = useState<string>("");
    const qrRef = useRef<HTMLDivElement>(null);
    const qrInstance = useRef<QRCodeStyling | null>(null);
    const [fee, setFee] = useState(0);
    //const [feeTerm, setFeeTerm] = useState(1);
    const [feeUsd, setFeeUsd] = useState(0);
    const [fiat, setFiat] = useState("$");
    const [payload, setPayload] = useState("");
    const [link, setLink] = useState("");
    const [copied, setCopied] = useState(false);

    const [enableBNPL, setEnableBNPL] = useState(false);
    const [loanTerm, setLoanTerm] = useState(1); // 1 - 6 periods(months), Default to 1 month

    const { showToast } = useToast();

    const handleWalletConnectClick = (buttonName: string) => {
        trackEvent(
            'wallet_click',      // Action
            'charge',      // Category (page name)
            buttonName        // Label (which button was clicked)
        );
    };

    // Update subtotals and payload
    useEffect(() => {
        if (amount && !isNaN(Number(amount))) {

            let symbol = "MXNe";
            let fiat = "$";
            let name = "MXN";
            let decimals = 2;
            if (token === "mxn") {
                symbol = "MXNe"; fiat = "MXN$"; name = "MXN"; decimals = 2;
            } else if (token === "brl") {
                symbol = "BRZ"; fiat = "R$"; name = "BRL"; decimals = 2;
            }
            setFee(rate * loanTerm * Number(amount) / 100);
            setFeeUsd(0);
            setFiat(fiat);

        } else {
            setQuote("");
        }
    }, [amount, token, allowFallback, enableBNPL, loanTerm]);

    // Copy link handler
    const handleCopy = () => {
        if (link) {
            navigator.clipboard.writeText(link);
            setCopied(true);
            showToast("Copied to clipboard", "success");
            setTimeout(() => setCopied(false), 1500);
        }
    };

    // Only render after mount to avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Init QR once
    useEffect(() => {
        console.log(`QR ref qrRef:${qrRef.current} qrInstance:${qrInstance.current} mounted:${mounted}`);
        if (mounted && qrRef.current && !qrInstance.current) {
            const qr = new QRCodeStyling({ width: 256, height: 256, data: "" });
            qrRef.current.innerHTML = "";
            qr.append(qrRef.current);
            qrInstance.current = qr;
        }
    }, [mounted, qrRef.current]);

    // Update payload whenever inputs change
    useEffect(() => {
        //console.log(`Updating payload qrInstance:${qrInstance.current} amount:${amount} token:${token} description:${description} allowFallback:${allowFallback} address:${address}`);
        if (qrInstance.current && amount && address) {
            const payload = {
                merchant: address,
                amount,
                token,
                description,
                allowFallback,
                enableBNPL,
                loanTerm
            };
            setLink(
                `${typeof window !== "undefined" ? window.location.origin : ""}/pay?data=${encodeURIComponent(
                    JSON.stringify(payload)
                )}`
            );
            setPayload(JSON.stringify(payload, null, 2));
            qrInstance.current.update({
                data: JSON.stringify(payload),
            });
        } else {
            setPayload("");
            setLink("");
        }
    }, [amount, token, description, allowFallback, enableBNPL, loanTerm, address]);

    return (
        <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
            <h1 className="text-3xl font-bold mb-6 mt-6">Charge Now</h1>
            <div className="w-full max-w-md mx-auto p-8 border border-[#264C73] rounded-lg shadow-lg space-y-6 text-center">
                <h2 className="text-2xl font-semibold mb-2">Payment Details</h2>
                <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                {mounted && ready && authenticated ? (
                    <>
                        {/* Grouped Card for Inputs */}
                        <div className="p-6 space-y-4 mb-4">
                            <Input
                                type="number"
                                placeholder="Amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                            />
                            <Input
                                type="string"
                                placeholder="Description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                            />
                            <select
                                className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                            >
                                <option value="mxn">MXN</option>
                                <option value="usd">USD</option>
                            </select>
                            {token !== "usd" && (
                                <label className="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        checked={allowFallback}
                                        onChange={e => setAllowFallback(e.target.checked)}
                                        className="h-5 w-5 text-[#50e2c3]"
                                    />
                                    <span>Enable USD fallback</span>
                                </label>
                            )}
                            {allowFallback && (
                                <div className="mt-4 p-8 border border-gray-400 rounded-lg">
                                    <label className="block text-gray-400 text-sm mb-2">
                                        You will receive USD if the customer doesn't have local currency (MXN)
                                    </label>
                                </div>
                            )}
                            <label className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={enableBNPL}
                                    onChange={e => {
                                        if (!e.target.checked) setLoanTerm(1);
                                        setEnableBNPL(e.target.checked);
                                    }
                                    }
                                    className="form-checkbox h-5 w-5 text-[#50e2c3]"
                                />
                                <span className="">Enable BNPL</span>
                            </label>
                            {enableBNPL && (
                                <div className="mt-4 p-8 border border-gray-400 rounded-lg space-y-3">
                                    <span className="text-sm mb-2 text-[#50e2c3]"><strong>Loan Term (months): Up to...</strong></span>
                                    <select
                                        value={loanTerm}
                                        onChange={(e) => setLoanTerm(Number(e.target.value))}
                                        className="w-full p-3 mb-2 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                                    >
                                        <option value={1}>1 month</option>
                                        <option value={2}>2 months</option>
                                        <option value={3}>3 months</option>
                                        <option value={4}>4 months</option>
                                        <option value={5}>5 months</option>
                                        <option value={6}>6 months</option>
                                    </select>
                                    <label className="block text-gray-400 text-sm">
                                        Every extra month in the loan term adds a 1% discount on the money you will receive, corresponding to the loan fee
                                    </label>
                                </div>
                            )}

                        </div>
                        {/* Subtotal */}
                        {amount && !isNaN(Number(amount)) && (
                            <div className="text-lg font-medium text-[#50e2c3] mb-2">
                                You will receive minimun {fiat}{(Number(amount) - fee).toFixed(Number(amount) < 0.999 ? 3 : 2)}* {quote && (
                                    <>
                                        (≈ $USD {(Number(quote) - feeUsd).toFixed(Number(amount) < 0.999 ? 3 : 2)})
                                        <br /><span className="text-xs text-white">($USD 1  ≈ {fiat}{(Number(amount) / Number(quote)).toFixed(Number(amount) < 0.999 ? 3 : 2)})</span>
                                    </>
                                )}
                                <br /><span className="text-xs text-white">*Including up to {rate * loanTerm}% of fee( {fiat}{(Number(fee)).toFixed(Number(amount) < 0.999 ? 3 : 2)} {quote && (`≈ $USD ${(Number(feeUsd)).toFixed(Number(amount) < 0.999 ? 3 : 2)}`)})</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-8">
                        <p className="text-lg text-gray-500">
                            Please connect your wallet to generate the payment QR code.
                        </p>
                        <LoginButton
                            size="xl"
                            className="flex items-center mx-auto py-2 px-4 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                        >
                            Get Started
                        </LoginButton>
                    </div>
                )}

                {/* QR and Copy Link */}
                <div className="flex flex-col items-center space-y-2 mt-6">
                    <div ref={qrRef} className="mb-2" />
                    {link && (
                        <Button
                            onClick={handleCopy}
                            variant="default"
                            size="sm"
                            className="mt-2 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full"
                        >{copied ? "Copied!" : "Copy payment link"}</Button>
                    )}
                </div>
                {/* JSON Preview */}
                {payload && (
                    <div className="bg-gray-900 rounded-md p-4 mt-4 text-left text-xs text-gray-300 overflow-x-auto">
                        <div className="font-bold text-[#50e2c3] mb-1">Payment Payload Preview</div>
                        <pre>{payload}</pre>
                    </div>
                )}
            </div>

        </div>
    );
}
