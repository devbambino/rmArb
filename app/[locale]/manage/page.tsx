"use client"
import { useState, useEffect } from "react";
import { useAccount, useBalance, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toastprovider";
import { Loader2 } from "lucide-react";
import { trackEvent } from '@/lib/analytics';
import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from '@/components/LoginButton';
import { usdcAbi } from "@/lib/usdc-abi";
import { parseUnits } from 'viem';

const MXN_ADDR = process.env.NEXT_PUBLIC_MXN_ADDRESS!;
const USD_ADDR = process.env.NEXT_PUBLIC_USD_ADDRESS!;
const UNISWAP_SWAP_USDC_URL = process.env.NEXT_PUBLIC_UNISWAP_SWAP_POOL_FROM_MXN_URL!;
//RapiMoni's main wallet address asigned by Juno for crypto-deposits
const RAPI_MONI_JUNO_WALLET = process.env.NEXT_PUBLIC_RAPI_MONI_JUNO_WALLET!;

export default function ManagePage() {
    const { showToast } = useToast();
    const { address } = useAccount();
    const { ready, authenticated } = usePrivy();

    // State for balances
    const { data: userBalanceInMXNData, refetch: getUserBalanceMXN } = useBalance({ address, token: MXN_ADDR as `0x${string}` });
    const { data: userBalanceInUSDData, refetch: getUserBalanceUSD } = useBalance({ address, token: USD_ADDR as `0x${string}` });

    // Wagmi hook for the on-chain MXNb transfer
    const { writeContractAsync: transferMxnb, isPending: isTransferPending } = useWriteContract();

    // State for UI and flows
    const [isLoading, setIsLoading] = useState(false);
    const [flowMessage, setFlowMessage] = useState('');

    // On-Ramp State
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState('');

    // Off-Ramp State
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');

    // CLABE Management State
    const [isClabeModalOpen, setIsClabeModalOpen] = useState(false);
    const [generatedClabe, setGeneratedClabe] = useState('');
    const [legalName, setLegalName] = useState('');

    // --- Local Storage and Juno Bank Account ---
    const [junoBankAccount, setJunoBankAccount] = useState<any>(null);

    useEffect(() => {
        if (!authenticated || !address) return;

        const savedAccount = localStorage.getItem(`junoAccount_${address}`);
        if (savedAccount) {
            setJunoBankAccount(JSON.parse(savedAccount));
            //console.log("useEffect savedAccount:", savedAccount);
        }
    }, [authenticated, address]);

    // --- Helper function to call our backend API ---
    async function callBackendApi(action: string, params: object = {}) {
        const response = await fetch('/api/juno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...params }),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'API request failed');
        }
        return result;
    }

    // --- Prerequisite Flow ---
    const handleGetOrCreateBankAccount = async () => {
        if (junoBankAccount) return junoBankAccount;

        setIsLoading(true);
        setFlowMessage('Checking for your Juno account...');
        try {
            const { account } = await callBackendApi('getBankAccount', { walletAddress: address });
            if (account) {
                //console.log("handleGetOrCreateBankAccount account:", account);
                localStorage.setItem(`junoAccount_${address}`, JSON.stringify(account));
                setJunoBankAccount(account);
                setIsLoading(false);
                return account;
            }

            // If no account, generate a CLABE and open the modal
            const { clabe } = await callBackendApi('generateClabe');
            setGeneratedClabe(clabe);
            setIsClabeModalOpen(true);
            setIsLoading(false);
            return null; // Stop the flow until user confirms CLABE
        } catch (error: any) {
            showToast(error.message, 'error');
            setIsLoading(false);
            return null;
        }
    };

    const handleConfirmClabe = async () => {
        setIsLoading(true);
        setFlowMessage('Saving your bank account...');
        try {
            //console.log("handleConfirmClabe address:", address!, " generatedClabe:", generatedClabe, " legalName:", legalName);
            const result = await callBackendApi('createBankAccount', { walletAddress: address!, clabe: generatedClabe, legalName: legalName });
            const newAccount = result.payload;
            localStorage.setItem(`junoAccount_${address}`, JSON.stringify(newAccount));
            setJunoBankAccount(newAccount);
            setIsClabeModalOpen(false);
            showToast('Bank account saved successfully!', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- On-Ramp Flow ---
    const handleTopUpClick = async () => {
        const account = await handleGetOrCreateBankAccount();
        if (account) {
            setIsTopUpModalOpen(true);
        }
    };

    const handleInitiateTopUp = async () => {
        if (!topUpAmount || !junoBankAccount) return;

        setIsLoading(true);
        setIsTopUpModalOpen(false);
        setFlowMessage('Initiating mock deposit...');
        try {
            //console.log("handleInitiateTopUp clabe:", junoBankAccount.clabe, " recipient_legal_name:", junoBankAccount.recipient_legal_name);
            const depositResult = await callBackendApi('initiateOnRampDeposit', {
                amount: topUpAmount,
                userClabe: junoBankAccount.clabe,
                userLegalName: junoBankAccount.recipient_legal_name
            });
            const isoDateFrom = new Date(Date.now() - 60000).toISOString(); // check last minute for tx
            //console.log("handleInitiateTopUp isoDateFrom:", isoDateFrom);

            setFlowMessage('Confirming issuance...');
            // Polling logic: For brevity, this is simplified. Production version would use polling)
            await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate polling

            setFlowMessage('Issuance complete! Withdrawing MXNb to your wallet...');
            //console.log("handleInitiateTopUp topUpAmount:", topUpAmount, " address:", address!);
            await callBackendApi('withdrawMxnbToWallet', { amount: topUpAmount, walletAddress: address! });

            await new Promise(resolve => setTimeout(resolve, 12000)); // Simulate polling

            showToast('TopUp successful! Your balance will update shortly.', 'success');
            getUserBalanceMXN();

        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsLoading(false);
            setFlowMessage('');
            setTopUpAmount('');
        }
    };

    // --- Off-Ramp Flow ---
    const handleWithdrawClick = async () => {
        const account = await handleGetOrCreateBankAccount();
        if (account) {
            setIsWithdrawModalOpen(true);
        }
    };

    const handleInitiateWithdrawal = async () => {
        if (!withdrawAmount || !junoBankAccount) {
            showToast("Please enter a valid amount.", "error");
            return;
        }

        const amountInSmallestUnit = parseUnits(withdrawAmount, 6);
        if (amountInSmallestUnit > (userBalanceInMXNData?.value ?? 0)) {
            showToast("Insufficient MXNb balance.", "error");
            return;
        }

        setIsLoading(true);
        setIsWithdrawModalOpen(false);
        setFlowMessage('Please approve the transfer in your wallet...');

        try {
            // Step 1: User sends MXNb to RapiMoni's Juno wallet
            await transferMxnb({
                abi: usdcAbi, // Standard ERC20 transfer function
                address: MXN_ADDR as `0x${string}`,
                functionName: 'transfer',
                args: [RAPI_MONI_JUNO_WALLET! as `0x${string}`, amountInSmallestUnit],
            });

            setFlowMessage('Processing deposit on Juno...');
            // In production, we will poll for the CRYPTO_DEPOSIT transaction here.
            await new Promise(resolve => setTimeout(resolve, 10000)); // Simulate polling

            setFlowMessage('Finalizing redemption to your bank...');
            // Step 2: Call backend to trigger redemption from Juno to user's bank
            await callBackendApi('initiateOffRampRedemption', {
                amount: parseFloat(withdrawAmount),
                bankId: junoBankAccount.id,
            });

            await new Promise(resolve => setTimeout(resolve, 15000)); // Simulate polling for redemption

            showToast('Withdrawal initiated! Funds are on their way to your bank.', 'success');
            getUserBalanceMXN();

        } catch (error: any) {
            if (error.message.includes('rejected')) {
                showToast('Transaction rejected.', 'error');
            } else {
                showToast(error.message, 'error');
            }
        } finally {
            setIsLoading(false);
            setFlowMessage('');
            setWithdrawAmount('');
        }
    };

    return (
        <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
            <h1 className="text-3xl font-bold mt-6 mb-6">Manage Now</h1>
            {address && ready && authenticated ? (
                <>
                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-50">
                            <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
                            <p className="px-2 text-white text-lg text-center w-full">{flowMessage}</p>
                        </div>
                    )}

                    {/* CLABE Modal */}
                    {isClabeModalOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40">
                            <div className="bg-primary p-8 rounded-lg shadow-lg text-center max-w-md mx-4">
                                <h3 className="text-2xl font-bold mb-4">Confirm Your Bank Account</h3>
                                <p className="text-neutral mb-6">To deposit/withdraw funds from/to your bank account, we need your 18-digit CLABE, and your legal name associated to the account.</p>
                                <div className="mb-6 p-8 border border-gray-400 rounded-lg space-y-3">
                                    <label className="block text-white/50 text-sm">
                                        <b>Production Version:</b> We have generated one CLABE for you for testing purposes, but in the production version you will need to replace it with your own valid CLABE.
                                    </label>
                                </div>
                                <Input
                                    value={generatedClabe}
                                    onChange={(e) => setGeneratedClabe(e.target.value)}
                                    className="mb-6 w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                                />
                                <Input
                                    value={legalName}
                                    onChange={(e) => setLegalName(e.target.value)}
                                    placeholder="Your Legal Name"
                                    className="mb-6 w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                                />
                                <div className="flex justify-center gap-4">
                                    <Button onClick={() => setIsClabeModalOpen(false)} className="px-8 py-2 border-4 border-[#264C73] hover:bg-[#50e2c3] hover:border-[#50e2c3] text-white hover:text-gray-900 rounded-full">Cancel</Button>
                                    <Button onClick={handleConfirmClabe} className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Confirm and Save Account</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TopUp Modal */}
                    {isTopUpModalOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40">
                            <div className="bg-primary p-8 rounded-lg shadow-lg text-center max-w-md mx-4">
                                <h3 className="text-2xl font-bold mb-4">TopUp Wallet (Testnet)</h3>
                                <p className="text-neutral mb-6">Enter the amount of MXN you want to simulate depositing.</p>
                                <Input
                                    type="number"
                                    placeholder="Amount in MXN"
                                    value={topUpAmount}
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    className="mb-6 w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                                />
                                <div className="mb-6 p-8 border border-gray-400 rounded-lg space-y-3">
                                    <label className="block text-white/50 text-sm">
                                        <b>Production Version:</b> In production, you will need to make a SPEI transfer from your personal bank account to the following RapiMoni account CLABE:
                                    </label>
                                    <span className="text-sm mb-2 text-[#50e2c3]"><strong>710969000000397144</strong></span>
                                </div>
                                <div className="flex justify-center gap-4">
                                    <Button onClick={() => setIsTopUpModalOpen(false)} className="px-8 py-2 border-4 border-[#264C73] hover:bg-[#50e2c3] hover:border-[#50e2c3] text-white hover:text-gray-900 rounded-full">Cancel</Button>
                                    <Button onClick={handleInitiateTopUp} className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Initiate Mock Deposit</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Withdraw to Bank Modal */}
                    {isWithdrawModalOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40">
                            <div className="bg-primary p-8 rounded-lg shadow-lg text-center max-w-md mx-4">
                                <h3 className="text-2xl font-bold mb-4">Withdraw to Bank</h3>
                                <p className="text-neutral mb-6">Enter the amount of MXNb you wish to withdraw to your saved bank account.</p>
                                <Input
                                    type="number"
                                    placeholder={`Max: ${userBalanceInMXNData?.formatted ?? '0.00'}`}
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    className="mb-6 w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                                />
                                <div className="flex justify-center gap-4">
                                    <Button onClick={() => setIsWithdrawModalOpen(false)} className="px-8 py-2 border-4 border-[#264C73] hover:bg-[#50e2c3] hover:border-[#50e2c3] text-white hover:text-gray-900 rounded-full">Cancel</Button>
                                    <Button onClick={handleInitiateWithdrawal} className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">
                                        {isTransferPending ? <Loader2 className="animate-spin" /> : 'Initiate Withdrawal'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* USDC section */}
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        <h2 className="text-2xl font-semibold mb-2">USD Balance</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <div className="text-4xl mb-2">🇺🇸</div>
                        <span className="text-[#50e2c3]">You have</span>
                        <p className="text-2xl font-bold">{Number(userBalanceInUSDData?.formatted).toFixed(2)} USDC</p>
                        {(userBalanceInMXNData && userBalanceInMXNData?.value > 0) && (
                            <>
                                <a href={UNISWAP_SWAP_USDC_URL} target="_blank" className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Get USDC(Mainnet)</a>
                                <br />
                            </>
                        )}
                    </div>

                    {/* MXN section */}
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        <h2 className="text-2xl font-semibold mb-2">MXN Balance</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <div className="text-4xl mb-2">🇲🇽</div>
                        <span className="text-[#50e2c3]">You have</span>
                        <p className="text-2xl font-bold ">{Number(userBalanceInMXNData?.formatted).toFixed(2)} MXNb</p>

                        <div className="flex justify-center gap-4">
                            <Button onClick={handleTopUpClick} className="px-4 py-6 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">TopUp Wallet</Button>
                            {/* Enable the button and link it to the new handler */}
                            <Button onClick={handleWithdrawClick} className="px-4 py-6 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Withdraw to Bank</Button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="mt-8">
                    <p className="text-lg text-gray-500">Please sign in to start managing your balance.</p>
                    <LoginButton size="xl" className="flex items-center mx-auto py-2 px-4 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">
                        Get Started
                    </LoginButton>
                </div>
            )}
        </div>
    )
}