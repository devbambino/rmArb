import { useAccount, useReadContract, useWriteContract, useSimulateContract } from 'wagmi';
import { liquidityPoolAbi } from "@/lib/liquiditypool-abi";
import { feePoolAbi } from "@/lib/feepool-abi";
import {microloanAbi} from '@/lib/microloan-abi'
import { parseUnits } from 'viem';

const { address } = useAccount();
const { writeContract } = useWriteContract();

export function useUserShares() {
    const { data: shares } = useReadContract({
        address: process.env.NEXT_PUBLIC_LIQUIDITY_POOL! as `0x${string}`,
        abi: liquidityPoolAbi,
        functionName: 'shares',
        args: [address!],
    });
    return shares;
}

export function useDeposit(amount: string, tokenDecimals: number) {
    return writeContract({
        address: process.env.NEXT_PUBLIC_LIQUIDITY_POOL! as `0x${string}`,
        abi: liquidityPoolAbi,
        functionName: 'deposit',
        args: [parseUnits(amount, tokenDecimals)],
    });
}



export function useCollectFee(feeAmount: string) {
  return writeContract({
    address: process.env.NEXT_PUBLIC_FEE_POOL! as `0x${string}`,
    abi: feePoolAbi,
    functionName: 'collectFee',
    args: [parseUnits(feeAmount, 6)],  // MXNe decimals
  });
}

export function useClaimFees() {
  return writeContract({
    address: process.env.NEXT_PUBLIC_FEE_POOL! as `0x${string}`,
    abi: feePoolAbi,
    functionName: 'claim',
  });
}



export function useRepay(repaymentAmt: string) {
  return writeContract({
    address: process.env.NEXT_PUBLIC_MICROLOAN! as `0x${string}`,
    abi: microloanAbi,
    functionName: 'repay',
    args: [parseUnits(repaymentAmt, 6)],
  });
}


export interface Balances {
    usdc: string;
    mxne: string;
    brz: string;
    history: { date: string; net: number }[]; // placeholder
}

/**
 * Fetch on-chain balances for USDC, MXNe, and BRZ for a given address.
 */
import { createPublicClient } from 'viem';
import { http } from 'viem';
import { base } from 'viem/chains';
import { formatUnits } from 'viem/utils';

// 2. ERC-20 token addresses on Base
const USDC_ADDRESS = '0xYourUSDCContractAddress';
const MXNE_ADDRESS = '0xYourMXNEContractAddress';
const BRZ_ADDRESS = '0xYourBRZContractAddress';

// 3. Token metadata for formatting
interface TokenInfo {
    address: `0x${string}`;
    decimals: number;
    symbol: string;
}

const TOKENS: Record<string, TokenInfo> = {
    USDC: { address: USDC_ADDRESS, decimals: 6, symbol: 'USDC' },
    MXNe: { address: MXNE_ADDRESS, decimals: 6, symbol: 'MXNe' },
    BRZ: { address: BRZ_ADDRESS, decimals: 6, symbol: 'BRZ' },
};

// Create a standalone PublicClient for Base
const publicClient = createPublicClient({
    chain: base,
    transport: http(),
});

export interface Balances {
    usdc: string;
    mxne: string;
    brz: string;
    history: { date: string; net: number }[]; // placeholder
}

/**
 * Fetch on-chain balances for USDC, MXNe, and BRZ for a given address.
 */
export async function fetchBalances(address: `0x${string}`): Promise<Balances> {
    async function getBalance(token: TokenInfo) {
        const raw = await publicClient.readContract({
            address: token.address,
            abi: [
                {
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'owner', type: 'address' }],
                    outputs: [{ name: 'balance', type: 'uint256' }],
                },
            ],
            functionName: 'balanceOf',
            args: [address],
        });
        return formatUnits(raw as bigint, token.decimals);
    }

    const [usdc, mxne, brz] = await Promise.all([
        getBalance(TOKENS.USDC),
        getBalance(TOKENS.MXNe),
        getBalance(TOKENS.BRZ),
    ]);

    const history: { date: string; net: number }[] = [];
    return { usdc, mxne, brz, history };
}




export interface Transaction {
    id: string;
    date: string;
    type: 'In' | 'Out';
    amount: string;
    status: 'Confirmed' | 'Pending';
}

/**
 * Fetch token transfer history for an address using BaseScan.
 * Requires NEXT_PUBLIC_BASESCAN_API_KEY in your env.
 */
export async function fetchTransactions(address: `0x${string}`): Promise<Transaction[]> {
    const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
    const url = `https://api.basescan.org/api?module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== '1' || !Array.isArray(data.result)) return [];

    return data.result.slice(0, 50).map((tx: any) => ({
        id: tx.hash,
        date: new Date(Number(tx.timeStamp) * 1000).toLocaleDateString(),
        type: tx.from.toLowerCase() === address.toLowerCase() ? 'Out' : 'In',
        amount: formatUnits(BigInt(tx.value), Number(tx.tokenDecimal)),
        status: Number(tx.confirmations) > 0 ? 'Confirmed' : 'Pending',
    }));
}

