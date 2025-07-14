# RapiMoni  
<p align="center">
  <img src="./public/logo-sm.png" alt="RapiMoni Logo" width="160" />
</p>
<p align="center"><em>Empowering Purchases, Empowering You</em></p>

---

## IMPORTANT!!!!

The app is working on Arbitrum Sepolia. You will need Sepolia ETH, USDC and MXNb for testing. 

All the smart contracts are located inside `/contracts`.

The term period for the loans are scaled down to 1 min(60 secs) for testing, so 1 month of term adds 1 min to the term inside the smart contract.

For checking the proof of deployment go to: [Proof of Deployment](#proof-of-deployment)

---

## Intro 
RapiMoni is a DeFi platform built on Arbitrum, designed to bring seamless payments and zero-interest loans to underbanked communities in Latin America. With just a web browser and a wallet, merchants can generate QR codes or URL links to accept payments in local stablecoins—MXNb (pegged to MXN)— and users can choose to pay on the spot or tap into a Buy-Now-Pay-Later loan collateralized with USDT/USDC.

---

## Quick Demo  

[▶️ View Demo on YouTube](https://youtu.be/Os9hzjqSaXE)
_Check out a quick walkthrough of QR/URL payments and microloan flows for Mexico._

---

## Problem

* **Massive Underbanking:** Over 5.4 billion adults globally lack access to financing and formal savings.
* **Poor Yield on Bank Deposits:** Almost 0% for Mexico/Colombia, and less than 2% for India/Indonesia.
* **Huge Finance Gap for mSMEs:** 65M mSMEs with unmet financing needs around the $5.7T.

---

## Solution 
RapiMoni is helping small businesses to sell more and to have a positive cashflow with:
* **Seamless On/OffRamp**: Users buy/sell MXNb seamless thanks to Juno API implementations.
* **Zero-Interest DeFi Loans for their Customers**: Collateralized with USDT/USDC. Merchant fees fund the model—no interest for customers.
* **Instant QR/URL Payments with Low Fees (no app required)**: Merchants deploy dynamic on-chain invoices; customers pay in digital pesos, digital dollars or loans.
* **High Yields with Impact**: ~10% APY for MXNb liquidity providers, who are helping the small businesses.
* **Future Extensions**: Idle USDT/USDC collateral can earn yield in Aave, 50% of which could back a native MONI token for rewards and governance.

---

## Features  
### 1. Frictionless Onboarding  
- Just a web browser and a valid email are needed to signUp/In, and start enjoying RapiMoni services. 

### 2. Instant QR/URL Payments  
- Merchants generate a QR code or share a URL with payment details.  
- Customers open the link or scan the QR → review price & select payment type  → confirm USD value if no balance in MXNb → payment sent in MXNb or USDC.   

### 3. Multi-Rail Cash In/Out  
- Via **Bitso/Juno APIs**, convert between digital Pesos(MXNb) and local fiat in seconds. 
- User's CLABE number from the bank account is the key to this easy process. 

### 4. Zero-Interest Microloans  
- Users select BNPL, choose term (1–6 months), deposit 120% USDC collateral.  
- Receive MXNb instantly; repay monthly with zero interest; merchant covers microloan fees.  

### 5. Lender Yield  
- Merchant microloan fees (1–3% per month) split: 90% → lenders, and 10% → protocol's treasury.  
- (Future) On-chain liquidation via Uniswap pools if monthly repayment is missed. 

### 6. On-Chain Swaps  
- If customer's balance isn’t in the merchant’s preferred currency, a swap using Uniswap is offered.  
- Uses **Uniswap** USDC/MXNb pool for optimized rates and liquidity. 

### 7. Yield Stacking (Future)  
- Idle USDT/USDC supplies to **Aave**, ~3–6% APY.  

### 8. MONI Token Rewards (Future)  
- Fraction of idle yield(50%) backs a native **MONI** token for gamified staking and governance.

---

## Architecture Overview

### 1. LiquidityPool

* **Token**: MXNb
* **Function**: Single-sided deposits mint “shares,” track balances; withdrawals burn shares; disburse and collect flows integrate with the loan manager.

### 2. MicroloanManager

* **Collateral**: Users deposit USDC (120% of purchase amount), open loan to receive MXNb instantly.
* **Repayment**: Monthly zero-interest payments; on full repayment, collateral unlocked.
* **Liquidation**: Overdue loans can be liquidated by seizing collateral.

### 3. FeePool

* **Fee Collection**: Aggregates merchant-paid fees from BNPL flows.
* **Accrual & Distribution**: Splits fees—90% claimable by liquidity providers pro-rata, 10% to treasury. Enforces claim cooldown based on loan term.

#### Data & Integration

* **On/OffRamp**: Thanks to Juno APIs, the On/Off Ramps flow was properly implemented.
* **Social Login**: Seamless registration and login with Privy.io SDks.
* **Frontend**: React/Next.js app with WAGMI hooks for ManagePage, PayPage, ChargePage, LendPage, BorrowPage, leveraging the above contracts, and TailwindCSS for UIs.
* **Swaps**: Uniswap's liquidity pool for onchain USDC↔MXNb swapping.

#### Future
* **Oracles**: Onchain USD/MXN feed (or fallback) for pricing and collateral calculations.
* **LiquidationHook**: Uniswap router integration for auto-swaps on default.
* **RewardsManager**: Aave integration, idle yield tracking, and MONI distribution.

---

## Proof Of Deployment

### RapiMoni Contracts in Arbitrum Sepolia
```bash
NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=0x9505fA056A1e28Ff089EC05347D097d1bA5fB5EE
NEXT_PUBLIC_FEE_POOL_ADDRESS=0xCDD49D4885F0660d2f84adE9c38c72a503Eb7C33
NEXT_PUBLIC_MANAGER_ADDRESS=0xF4dCC54021B22a891E0871F52213D7Bf0CF91981
#Test Tokens
NEXT_PUBLIC_USD_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d # USDC
NEXT_PUBLIC_MXN_ADDRESS=0x82B9e52b26A2954E113F94Ff26647754d5a4247D # MXNb
```
---

## Installation  
```bash
git clone https://github.com/devbambino/rmArb.git
cd rmarb
npm install
```

- Create a `.env` with your keys and copy `.env.template`:


- Start the dev server:

```bash
npm run dev
```

---

## Usage

### Merchant Flow

1. Log in with email.
2. Go to /Charge and generate QR/URL with `amount`, `description`, `currency`, `allow fallback` check, and optional `loan` settings.
3. Share link or display QR for customer checkout.

### Customer Flow

1. Go to /Pay and scan QR or open URL.
2. Select “Pay directly” or Pay with BNPL”
3. For BNPL: approve and deposit USDC collateral, and receive MXNb.
4. Confirm purchase.
5. Go to /Borrow and repay monthly as scheduled.

### Lender Flow

1. Go to /Lend and deposit MXNb.
2. View accrued yield (~10% APY).
3. Claim yield.

---

## Roadmap

| Phase       | Deliverables                                                                |
| ----------- | --------------------------------------------------------------------------- |
| **Phase 1** | QR/URL payments, merchant/customer/lender flows.                            |
| **Phase 2** | Microloan flow. Smart contracts: LiquidityPool, MicroloanManager, FeePool.  |
| **Phase 3** | Oracle integration, multi-rail off ramps, comprehensive testing.         |
| **Phase 4** | Mainnet deployment & merchant partnerships.                                 |
| **Future**  | YieldManager on Aave, RewardsManager, MONI token launch.                    |

---

## Acknowledgments

* Special thanks to the Bitso Business, Juno and Arbitrum team for building a wonderful suit of tools that made this project possible.

---
