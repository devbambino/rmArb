"use client"
import { useState, useEffect } from "react";
import { useAccount, useBalance } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toastprovider";
import { Loader2 } from "lucide-react";
import { trackEvent } from '@/lib/analytics';
import { usePrivy } from '@privy-io/react-auth';
import { LoginButton } from '@/components/LoginButton';

const MXN_ADDR = process.env.NEXT_PUBLIC_MXN_ADDRESS!;
const USD_ADDR = process.env.NEXT_PUBLIC_USD_ADDRESS!;

export default function ManagePage() {
    const { showToast } = useToast();
    const { address } = useAccount();
    const { ready, authenticated } = usePrivy();

    // State for balances
    const { data: userBalanceInMXNData, refetch: getUserBalanceMXN } = useBalance({ address, token: MXN_ADDR as `0x${string}` });
    const { data: userBalanceInUSDData, refetch: getUserBalanceUSD } = useBalance({ address, token: USD_ADDR as `0x${string}` });

    // State for UI and flows
    const [isLoading, setIsLoading] = useState(false);
    const [flowMessage, setFlowMessage] = useState('');

    // On-Ramp State
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState('');

    // CLABE Management State
    const [isClabeModalOpen, setIsClabeModalOpen] = useState(false);
    const [generatedClabe, setGeneratedClabe] = useState('');

    // --- Local Storage and Juno Bank Account ---
    const [junoBankAccount, setJunoBankAccount] = useState<any>(null);

    useEffect(() => {
        if (!authenticated || !address) return;

        const savedAccount = localStorage.getItem(`junoAccount_${address}`);
        if (savedAccount) {
            setJunoBankAccount(JSON.parse(savedAccount));
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
            console.log("handleConfirmClabe address:", address!, " generatedClabe:", generatedClabe);
            const result = await callBackendApi('createBankAccount', { walletAddress: address!, clabe: generatedClabe });
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
            console.log("handleInitiateTopUp clabe:", junoBankAccount.clabe, " recipient_legal_name:", junoBankAccount.recipient_legal_name);
            const depositResult = await callBackendApi('initiateOnRampDeposit', {
                amount: topUpAmount,
                userClabe: junoBankAccount.clabe,
                userLegalName: junoBankAccount.recipient_legal_name
            });
            const isoDateFrom = new Date(Date.now() - 60000).toISOString(); // check last minute for tx
            console.log("handleInitiateTopUp isoDateFrom:", isoDateFrom);

            setFlowMessage('Confirming issuance...');
            // Polling logic: For brevity, this is simplified. Production version would use polling)
            await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate polling

            setFlowMessage('Issuance complete! Withdrawing MXNb to your wallet...');
            console.log("handleInitiateTopUp topUpAmount:", topUpAmount, " address:", address!);
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


    return (
        <div className="min-h-screen text-white flex flex-col items-center px-4 py-12">
            <h1 className="text-3xl font-bold mt-6 mb-6">Manage Now</h1>
            {address && ready && authenticated ? (
                <>
                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="fixed inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-50">
                            <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
                            <p className="text-white text-lg">{flowMessage}</p>
                        </div>
                    )}

                    {/* CLABE Modal */}
                    {isClabeModalOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40">
                            <div className="bg-primary p-8 rounded-lg shadow-lg text-center max-w-md mx-4">
                                <h3 className="text-2xl font-bold mb-4">Confirm Your Bank Account</h3>
                                <p className="text-neutral mb-6">To deposit/withdraw funds from/to your bank account, we need your 18-digit CLABE. We have generated one for you, but you can replace it with your own if you prefer.</p>
                                <Input
                                    value={generatedClabe}
                                    onChange={(e) => setGeneratedClabe(e.target.value)}
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
                                    <label className="block text-gray-400 text-sm">
                                        In production, you would need to make a SPEI transfer from your personal bank account to the following RapiMoni account CLABE:
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

                    {/* USDC section */}
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        <h2 className="text-2xl font-semibold mb-2">USD Balance</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <div className="text-4xl mb-2">🇺🇸</div>
                        <span className="text-[#50e2c3]">You have</span>
                        <p className="text-2xl font-bold">{Number(userBalanceInUSDData?.formatted).toFixed(2)} USDC</p>
                        {/* Note: This external link might need to be replaced with the Bitso USDC to MXN OffRamp flow */}
                        <Button disabled className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Withdraw to Bank</Button>
                    </div>

                    {/* MXN section */}
                    <div className="w-full max-w-md mx-auto mt-6 mb-6 p-8 border border-[#264C73] rounded-lg space-y-6 text-center relative">
                        <h2 className="text-2xl font-semibold mb-2">MXN Balance</h2>
                        <div className="h-1 w-16 bg-[#264C73] mx-auto rounded mb-6" />
                        <div className="text-4xl mb-2">🇲🇽</div>
                        <span className="text-[#50e2c3]">You have</span>
                        <p className="text-2xl font-bold ">{Number(userBalanceInMXNData?.formatted).toFixed(2)} MXNb</p>

                        <div className="flex justify-center gap-4">
                            <Button onClick={handleTopUpClick} className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">TopUp Wallet</Button>
                            <Button disabled className="p-4 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">Withdraw to Bank</Button>
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