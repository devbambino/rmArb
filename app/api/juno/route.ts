// FILE: app/api/juno/route.ts (NEW)
import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// --- Environment Variables ---
const JUNO_API_KEY = process.env.JUNO_API_KEY!;
const JUNO_API_SECRET = process.env.JUNO_API_SECRET!;
const JUNO_BASE_URL = process.env.JUNO_BASE_URL!;
const RAPI_MONI_RECEIVER_CLABE = process.env.RAPI_MONI_RECEIVER_CLABE!; // RapiMoni's central account CLABE

// --- Reusable API Caller ---
async function callJunoApi(endpoint: string, method: 'GET' | 'POST' = 'GET', body: object | null = null) {
  if (!JUNO_API_KEY || !JUNO_API_SECRET) {
    throw new Error("Missing JUNO API credentials on server.");
  }

  const nonce = Date.now().toString();
  const payloadString = body ? JSON.stringify(body) : '';
  const message = `${nonce}${method}${endpoint}${payloadString}`;

  const signature = crypto
    .createHmac('sha256', JUNO_API_SECRET)
    .update(message)
    .digest('hex');

  const headers: HeadersInit = {
    'Authorization': `Bitso ${JUNO_API_KEY}:${nonce}:${signature}`,
    'Content-Type': 'application/json',
  };

  const url = JUNO_BASE_URL + endpoint;

  const response = await fetch(url, {
    method,
    headers,
    body: body ? payloadString : null,
  });

  if (!response.ok) {
    const errorText = await response.text();
    //console.error(`Juno API Error: ${response.status} ${response.statusText}`, errorText);
    throw new Error(`Juno API request failed: ${errorText}`);
  }

  return response.json();
}

// --- CLABE Generation Logic ---
function computeChecksum(clabeNum17: string): number {
  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += (parseInt(clabeNum17.charAt(i), 10) * weights[i % 3]) % 10;
  }
  return (10 - (sum % 10)) % 10;
}

function generateNewClabe(): string {
  const bankCode = "012";// BBVA, by default
  const cityCode = "180";// CDMX, by default
  let randomAccount = '';
  for (let i = 0; i < 11; i++) {
    randomAccount += Math.floor(Math.random() * 10).toString();
  }
  const clabe17 = `${bankCode}${cityCode}${randomAccount}`;
  const checksum = computeChecksum(clabe17);
  return `${clabe17}${checksum}`;
}


// --- Main API Handler ---
export async function POST(req: NextRequest) {
  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case 'getBankAccount': {
        const { walletAddress } = params;
        const response = await callJunoApi('/mint_platform/v1/accounts/banks');
        const accounts = response.payload || [];
        const existingAccount = accounts.find((acc: any) => acc.tag === walletAddress);
        return NextResponse.json({ account: existingAccount });
      }

      case 'generateClabe': {
        const newClabe = generateNewClabe();
        return NextResponse.json({ clabe: newClabe });
      }

      case 'createBankAccount': {
        const { walletAddress, clabe, legalName } = params;
        //const legalName = `${walletAddress.substring(0, 6)}${walletAddress.substring(walletAddress.length - 4)}`;
        const payload = {
          tag: walletAddress,
          recipient_legal_name: legalName,
          clabe: clabe,
          ownership: "THIRD_PARTY",
        };
        const newAccount = await callJunoApi('/mint_platform/v1/accounts/banks', 'POST', payload);
        return NextResponse.json(newAccount);
      }
      
      case 'initiateOnRampDeposit': {
        const { amount, userClabe, userLegalName } = params;
        const payload = {
            amount: amount.toString(),
            receiver_clabe: RAPI_MONI_RECEIVER_CLABE,
            receiver_name: userLegalName,
            sender_name: userLegalName,
            sender_clabe: userClabe,
        };
        const depositResponse = await callJunoApi('/spei/test/deposits', 'POST', payload);
        return NextResponse.json(depositResponse);
      }

      case 'getTransactionStatus': {
        const { txId, amountFrom, isoDateFrom, type } = params;
        let endpoint = '/mint_platform/v1/transactions';
        if (txId) {
            endpoint = `${endpoint}/${txId}`;
        } else {
            const query = new URLSearchParams({ amountFrom, isoDateFrom, type });
            endpoint = `${endpoint}?${query.toString()}`;
        }
        const statusResponse = await callJunoApi(endpoint);
        return NextResponse.json(statusResponse);
      }

      case 'withdrawMxnbToWallet': {
        const { amount, walletAddress } = params;
        const payload = {
            address: walletAddress,
            amount: amount.toString(),
            asset: "MXNB",
            blockchain: "ARBITRUM",
            compliance: {},
        };
        const withdrawalResponse = await callJunoApi('/mint_platform/v1/withdrawals', 'POST', payload);
        return NextResponse.json(withdrawalResponse);
      }

      case 'initiateOffRampRedemption': {
          const { amount, bankId } = params;
          const payload = {
              amount,
              destination_bank_account_id: bankId,
              asset: "mxn",
          };
          const redemptionResponse = await callJunoApi('/mint_platform/v1/redemptions', 'POST', payload);
          return NextResponse.json(redemptionResponse);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    //console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}