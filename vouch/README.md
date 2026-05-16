<p align="center">
  <img src="public/logo.png" alt="Vouch Logo" width="120" />
</p>

<h1 align="center">Vouch</h1>

<p align="center">
  <strong>Decentralized Escrow for Social Commerce</strong><br/>
  Marketplace-level trust — without the marketplace.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Built%20on-Solana-purple" alt="Solana" />
  <img src="https://img.shields.io/badge/Framework-Next.js%2015-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/Smart%20Contract-Rust%20%2F%20Anchor-orange" alt="Rust/Anchor" />
  <img src="https://img.shields.io/badge/Payment-Xendit-green" alt="Xendit" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT" />
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#%EF%B8%8F-architecture)
- [Smart Contracts](#-smart-contracts)
- [Payment Flow](#-payment-flow)
- [API Reference](#-api-reference)
- [Frontend Components](#-frontend-components)
- [Backend Services](#-backend-services)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Development](#-development)
- [Deployment](#%EF%B8%8F-deployment)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Tech Stack](#-tech-stack)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🎯 Overview

**Vouch** is a hybrid decentralized escrow platform that brings marketplace-level trust to social commerce transactions happening on Instagram, WhatsApp, and TikTok — without the marketplace fees or lock-in.

### The Problem

Social commerce in Southeast Asia is booming, but trust remains the biggest obstacle:

- **Buyers are afraid to pay first** → Scammers take money and disappear
- **Sellers are afraid to ship first** → Risk of non-payment
- **Marketplaces charge 10-20% fees** → Erodes profit margins
- **Platform lock-in** → Sellers can't own their customer relationships
- **Manual "trust me bro"** → Screenshots, reviews don't prevent fraud

**Result:** Billions in potential transactions lost due to lack of trust infrastructure in social commerce.

### The Solution

Vouch creates a **shareable payment link** that holds funds in a **smart contract escrow** on Solana:

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│   Seller    │      │    Buyer    │      │    Escrow    │      │   Seller    │      │    Buyer     │
│ creates link│ ───▶ │ pays (QRIS) │ ───▶ │ funds locked │ ───▶ │ ships item  │ ───▶ │   confirms   │
└─────────────┘      └─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
                                                                                              │
                                                                                              ▼
                                                                                     ┌──────────────────┐
                                                                                     │ Funds released   │
                                                                                     │ to seller wallet │
                                                                                     └──────────────────┘
```

**Key Innovation:**
- Buyers pay with familiar local payment methods (QRIS, bank transfer)
- Sellers receive funds in their own Solana wallet
- Smart contract ensures neither party can cheat
- No registration, no account creation, no marketplace fees

**Payment Options:**
- **Fiat (QRIS/VA/Bank Transfer):** Buyer pays with local payment methods via Xendit — **no wallet needed**
- **Crypto (USDC/IDRX):** Buyer pays directly on-chain with stablecoins — **wallet required**

**Protection Mechanisms:**
- **Buyer Protection:** Funds locked in smart contract escrow until delivery confirmed
- **Seller Protection:** Auto-release after timeout (e.g., 7 days) if buyer doesn't confirm delivery

---

## ✨ Features

### Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Decentralized Escrow** | Smart contract on Solana holds funds trustlessly | ✅ Live |
| **Fiat Payments** | QRIS, Bank Transfer, E-wallets via Xendit | ✅ Live |
| **Crypto Payments** | Direct USDC/IDRX funding on-chain | ✅ Live |
| **Seller Wallet** | Seller signs with their own Solana wallet | ✅ Live |
| **Buyer Anonymity** | No wallet needed for buyers (fiat flow) | ✅ Live |
| **Auto-Release** | Timeout protection for sellers | ✅ Live |
| **On-Chain Reputation** | Seller stats & star ratings stored permanently on Solana | ✅ Live |
| **Buyer Star Rating** | Buyers rate 1-5 stars post-delivery, stored on-chain | ✅ Live |
| **Verified Seller Badge** | Auto-granted after ≥5 completed transactions on-chain | ✅ Live |
| **Dispute Resolution** | Protocol-mediated with on-chain outcome & reputation update | ✅ Live |
| **Dashboard** | Sellers can track all escrows and reputation score | ✅ Live |
| **Mobile-First** | Optimized for DM sharing | ✅ Live |
| **Token Faucet** | Get testnet tokens for demo | ✅ Live |
| **Demo Pages** | Interactive chat simulations | ✅ Live |

### Advanced Features

- **Multi-Currency Support:** PHP, IDR, THB, SGD, MYR, VND, USD via currency API
- **Buyer Token:** Unique token for secure release authorization
- **Webhook Integration:** Real-time payment notifications from Xendit
- **On-Chain Verification:** All escrows and reputation scores verifiable on Solana Explorer
- **Portable Reputation:** Seller profile is a PDA — owned by the seller's wallet, not by Vouch
- **Responsive Design:** Works seamlessly on mobile and desktop
- **Dark Mode Ready:** Design system supports theme switching (future)

---

## 🏆 On-Chain Reputation System

Vouch features a fully on-chain, permissionless reputation system built directly into the Anchor smart contract. Every seller's track record is stored in a **Program Derived Account (PDA)** on Solana — permanent, censorship-resistant, and impossible to fake.

### Why On-Chain Reputation Matters

In social commerce, trust is the #1 barrier to transactions. Traditional platforms (Tokopedia, Shopee) solve this with centralized reviews that:
- Can be deleted or manipulated by the platform
- Cannot be transferred between platforms
- Require users to stay locked within the ecosystem

Vouch's reputation lives **on the blockchain**, meaning:
- ✅ **Immutable** — no one can delete a seller's transaction history
- ✅ **Portable** — any app can read it permissionlessly without asking Vouch
- ✅ **Self-Sovereign** — the seller truly **owns** their reputation
- ✅ **Auto-updating** — grows automatically with every verified sale

---

### `SellerProfile` Account Structure

Each seller has one `SellerProfile` PDA derived from their wallet address:

```rust
// PDA Seeds: ["seller-profile", seller_pubkey]
#[account]
pub struct SellerProfile {
    pub seller: Pubkey,           // The seller's wallet address (32 bytes)
    pub total_transactions: u64,  // Number of successfully completed escrows
    pub rating_sum: u64,          // Cumulative sum of all star ratings received
    pub rating_count: u64,        // Total number of individual ratings submitted
    pub disputes_won: u64,        // Number of disputes resolved in seller's favor
    pub verified: bool,           // Auto-set true after ≥5 transactions or ratings
    pub bump: u8,                 // PDA canonical bump for signature derivation
}
```

**Derived Metrics (calculated client-side):**
```
Average Rating  = rating_sum / rating_count     (range: 1.0 – 5.0 ★)
Verified Status = total_transactions >= 5
Reputation Score = f(total_transactions, avg_rating, disputes_won)
```

---

### Reputation Instructions (Smart Contract)

#### 1. `init_seller_profile` — One-time Setup

Must be called once by the seller before creating their first escrow. Creates the PDA account on-chain.

```typescript
const [sellerProfilePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("seller-profile"), sellerWallet.publicKey.toBuffer()],
  PROGRAM_ID
);

await program.methods
  .initSellerProfile()
  .accounts({
    seller: sellerWallet.publicKey,
    sellerProfile: sellerProfilePDA,
    systemProgram: SystemProgram.programId,
  })
  .signers([sellerWallet])
  .rpc();
```

---

#### 2. `update_seller_stats` — Auto-called On Success

This internal helper is called automatically by the contract on every successful outcome. It is **not** callable directly:

```rust
fn update_seller_stats(profile: &mut Account<SellerProfile>) -> Result<()> {
    // Increment total completed transactions atomically
    profile.total_transactions = profile.total_transactions.saturating_add(1);
    // Auto-grant verified badge once threshold is met
    if profile.rating_count >= 5 {
        profile.verified = true;
    }
    Ok(())
}
```

**Triggered automatically in these instructions:**

| Instruction | Trigger Condition |
|-------------|-------------------|
| `confirm_delivery` | Buyer explicitly confirms receipt ✅ |
| `release_funds` | Auto-release after timeout expires ✅ |
| `resolve_dispute` (seller wins) | Protocol resolves in seller's favor ✅ |

---

#### 3. `add_rating` — Buyer Submits Star Rating

After a successful delivery, buyers can submit a 1–5 star rating. Stored permanently on-chain.

```typescript
await program.methods
  .addRating(5)  // integer 1 through 5
  .accounts({
    buyer: buyerWallet.publicKey,
    escrowState: escrowPDA,
    sellerProfile: sellerProfilePDA,
  })
  .signers([buyerWallet])
  .rpc();
```

**On-chain validation enforced by the contract:**
- Rating must be between `1` and `5` (inclusive) — `InvalidRating` error if not
- Caller must be the verified buyer of that specific escrow — `Unauthorized` if not
- Escrow must be in `Released` or `Resolved` status — `InvalidStatus` if not
- Auto-grants `verified = true` if `rating_count >= 5` after this rating

---

#### 4. `resolve_dispute` — Dispute Affects Reputation

When a dispute is resolved in the seller's favor, `disputes_won` is incremented alongside `total_transactions`:

```rust
match outcome {
    DisputeOutcome::ReleaseToSeller => {
        // Seller wins the dispute: record it in reputation
        ctx.accounts.seller_profile.disputes_won =
            ctx.accounts.seller_profile.disputes_won.saturating_add(1);
        update_seller_stats(&mut ctx.accounts.seller_profile)?;
    }
    DisputeOutcome::ReleaseToBuyer => {
        // Buyer wins: refund issued, no reputation change for seller
        release_to_buyer(...)?
    }
}
```

---

### Verified Seller Badge Logic

The `verified` flag is set permanently once either condition is met:

```rust
// Condition A: enough total transactions
if profile.total_transactions >= 5 {
    profile.verified = true;
}

// Condition B: enough individual ratings from buyers
if profile.rating_count >= 5 {
    profile.verified = true;
}
```

Once verified, the badge **cannot be revoked** — it is a permanent milestone.

---

### On-Chain Events Emitted

All reputation state changes emit on-chain events for indexers:

```rust
#[event]
pub struct SellerProfileInitialized {
    pub seller: Pubkey,
}

#[event]
pub struct RatingAdded {
    pub seller: Pubkey,
    pub rating: u8,  // 1 to 5
}
```

---

### Reading Reputation from Frontend

Anyone can fetch a seller's full reputation **directly from Solana** — no Vouch API call needed:

```typescript
import { PublicKey, Connection } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";

// Derive the PDA for any seller's wallet
const [sellerProfilePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("seller-profile"), sellerPublicKey.toBuffer()],
  new PublicKey("5SGRD6bVjaD75nhMtnDqcjpVwqcqqsc6Z6sAGBwP3Q6W") // Program ID
);

// Fetch the on-chain account (readable by anyone)
const profile = await program.account.sellerProfile.fetch(sellerProfilePDA);

// Derive human-readable stats
const ratingCount = profile.ratingCount.toNumber();
const avgRating = ratingCount > 0
  ? (profile.ratingSum.toNumber() / ratingCount).toFixed(1)
  : "No ratings yet";

console.log({
  seller: profile.seller.toBase58(),
  totalTransactions: profile.totalTransactions.toNumber(), // e.g. 27
  averageRating: avgRating,                                // e.g. "4.8"
  disputesWon: profile.disputesWon.toNumber(),             // e.g. 1
  isVerified: profile.verified,                            // true
});
```

**Example Response:**
```json
{
  "seller": "AaBbCcDdEe...XxYyZz",
  "totalTransactions": 27,
  "averageRating": "4.8",
  "disputesWon": 1,
  "isVerified": true
}
```

---

### Reputation Lifecycle

```
Seller → init_seller_profile (one-time, on-chain PDA created)
         │
         ▼
Seller creates escrow → Buyer pays → Seller marks shipped
         │
         ▼
    [Path A: Normal Delivery]
    Buyer calls confirm_delivery()
         │
         └──► update_seller_stats()  →  total_transactions += 1
         └──► Buyer (optionally) calls add_rating(1-5)
                   rating_sum += stars, rating_count += 1
                   verified = true  (if count ≥ 5)

    [Path B: Auto-Release after Timeout]
    Protocol calls release_funds()
         └──► update_seller_stats()  →  total_transactions += 1

    [Path C: Dispute Filed & Won by Seller]
    Protocol calls resolve_dispute(ReleaseToSeller)
         └──► disputes_won += 1
         └──► update_seller_stats()  →  total_transactions += 1

    [Path D: Dispute Lost by Seller]
    Protocol calls resolve_dispute(ReleaseToBuyer)
         └──► Refund to buyer, no reputation change
```


## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph Users["👥 Users"]
        Seller["Seller<br/>(Requires Wallet)"]
        BuyerFiat["Buyer - Fiat<br/>(No Wallet Needed)"]
        BuyerCrypto["Buyer - Crypto<br/>(Requires Wallet)"]
    end

    subgraph Frontend["🖥️ Frontend (Next.js 15)"]
        Landing["/ Landing Page"]
        Create["/create - Seller"]
        Pay["/pay/[id] - Buyer"]
        Dashboard["/dashboard - Seller"]
        Demo["/demo/* - Demo Pages"]
        Deck["/deck - Pitch Deck"]
        Faucet["/faucet - Token Faucet"]
    end

    subgraph Backend["⚙️ Backend API (Express.js)"]
        EscrowRoutes["/api/escrow/*<br/>Metadata Storage"]
        PaymentRoutes["/api/payment/*<br/>Xendit Integration"]
        FaucetRoutes["/api/faucet/*<br/>Token Distribution"]
        Prisma[(PostgreSQL<br/>Metadata Storage)]
        HotWallet["🔐 Protocol Wallet<br/>Funds Fiat Escrows"]
    end

    subgraph Blockchain["⛓️ Solana Devnet"]
        VouchEscrow["lib.rs / Anchor<br/>Main Logic"]
        MockUSDC["SPL Token<br/>Test Stablecoin"]
        MockIDRX["SPL Token<br/>IDR Stablecoin"]
    end

    subgraph External["🌐 External Services"]
        Xendit["Xendit API<br/>Payment Gateway"]
        Currency["Currency API<br/>Exchange Rates"]
    end

    Seller --> Create
    BuyerFiat --> Pay
    BuyerCrypto --> Pay
    
    %% Seller creates escrow directly on-chain
    Create -->|"createEscrow()<br/>(Seller signs)"| VouchEscrow
    Create -->|"Save metadata"| EscrowRoutes
    EscrowRoutes --> Prisma
    
    %% Fiat payment flow (QRIS/VA - no wallet)
    Pay -->|"Fiat: QRIS/VA"| PaymentRoutes
    PaymentRoutes --> Xendit
    Xendit -."Webhook<br/>(Payment confirmed)".-> PaymentRoutes
    PaymentRoutes -->|"Fund escrow<br/>+ markFunded()"| HotWallet
    HotWallet -->|"Transfer USDC/IDRX<br/>+ markFunded()"| VouchEscrow
    
    %% Crypto payment flow (direct - requires wallet)
    Pay -."Crypto: Direct<br/>(Buyer signs)"..-> VouchEscrow
    
    Dashboard --> EscrowRoutes
    Faucet --> FaucetRoutes
    FaucetRoutes --> MockUSDC
    FaucetRoutes --> MockIDRX
    
    EscrowRoutes -."Read state".-> VouchEscrow
```

### Technology Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                         │
│  Next.js 15 | React 19 | TailwindCSS | Framer Motion       │
└─────────────────────────────────────────────────────────────┘
                            ▲ │
                            │ ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                          │
│  wagmi v2 | React Query | Zustand (State) | API Client      │
└─────────────────────────────────────────────────────────────┘
                            ▲ │
                            │ ▼
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                       │
│  Express.js | Prisma ORM | Ethers.js | Xendit SDK           │
└─────────────────────────────────────────────────────────────┘
                            ▲ │
                            │ ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA PERSISTENCE LAYER                     │
│  PostgreSQL (Metadata) | Solana Blockchain (Escrow State)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contracts

### Deployed Addresses (Solana Devnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| **VouchProgram** | `5SGRD6bVjaD75nhMtnDqcjpVwqcqqsc6Z6sAGBwP3Q6W` | [View on Explorer](https://explorer.solana.com/address/5SGRD6bVjaD75nhMtnDqcjpVwqcqqsc6Z6sAGBwP3Q6W?cluster=devnet) |
| **IDRX Mint** | `hBNyV8aQutBWyXdA42MXiAgwyQBom6GC8d9sBgkLKzG` | [View on Explorer](https://explorer.solana.com/address/hBNyV8aQutBWyXdA42MXiAgwyQBom6GC8d9sBgkLKzG?cluster=devnet) |
| **USDC Mint** | `GRyeQzyBoYBNqUp86wWyAWxb3ACtDGQw6QjVgimwa3GP` | [View on Explorer](https://explorer.solana.com/address/GRyeQzyBoYBNqUp86wWyAWxb3ACtDGQw6QjVgimwa3GP?cluster=devnet) |

### Network Configuration

| Property | Value |
|----------|-------|
| **Network Name** | Solana Devnet |
| **Chain ID** | `103` |
| **RPC URL** | `https://api.devnet.solana.com` |
| **Currency Symbol** | SOL |
| **Block Explorer** | `https://explorer.solana.com/?cluster=devnet` |
| **Faucet** | `https://faucet.solana.com` |

### VouchEscrow.sol - State Machine

```mermaid
stateDiagram-v2
    [*] --> CREATED: createEscrow()<br/>(Seller signs)
    
    CREATED --> FUNDED: markFunded()<br/>(Fiat payment)
    CREATED --> FUNDED: fundEscrow()<br/>(Crypto payment)
    
    FUNDED --> RELEASED: releaseFunds()<br/>(Buyer confirms)
    FUNDED --> RELEASED: Auto-release<br/>(After timeout)
    
    CREATED --> CANCELLED: cancelEscrow()<br/>(Before funding)
    FUNDED --> REFUNDED: refundEscrow()<br/>(Dispute resolution)
    
    RELEASED --> [*]
    CANCELLED --> [*]
    REFUNDED --> [*]
```

### Contract Functions Reference

| Function | Signature | Access Control | Description |
|----------|-----------|----------------|-------------|
| `createEscrow` | `(address token, uint256 amount, uint256 releaseTime) returns (uint256)` | Public | Create new escrow (seller = msg.sender) |
| `fundEscrow` | `(uint256 escrowId)` | Public | Fund escrow directly with crypto (buyer must approve token first) |
| `markFunded` | `(uint256 escrowId, address buyer)` | Protocol Only | Mark escrow as funded after fiat payment verification. Protocol wallet transfers IDRX to contract before calling this. |
| `releaseFunds` | `(uint256 escrowId)` | Buyer/Protocol | Release funds to seller (immediate if buyer, after timeout if protocol) |
| `cancelEscrow` | `(uint256 escrowId)` | Protocol Only | Cancel unfunded escrow |
| `refundEscrow` | `(uint256 escrowId)` | Protocol Only | Refund funded escrow to buyer (dispute resolution) |
| `getEscrow` | `(uint256 escrowId)` | View | Get full escrow details |
| `getEscrowStatus` | `(uint256 escrowId)` | View | Get human-readable status string |
| `getSellerEscrows` | `(address seller)` | View | Get all escrow IDs for a seller address |
| `updateProtocolWallet` | `(address newWallet)` | Protocol Only | Update protocol wallet address |

### Escrow Data Structure

```solidity
struct Escrow {
    address seller;        // Receives funds on release
    address buyer;         // Confirms delivery (can be zero for anonymous)
    address token;         // ERC20 token (USDC/IDRX)
    uint256 amount;        // Escrow amount in token's smallest unit
    uint256 releaseTime;   // Unix timestamp for auto-release eligibility
    bool funded;           // Payment received
    bool released;         // Funds sent to seller
    bool cancelled;        // Escrow cancelled/refunded
}
```

### Events

```solidity
event EscrowCreated(uint256 indexed escrowId, address indexed seller, uint256 amount, uint256 releaseTime);
event EscrowFunded(uint256 indexed escrowId, address indexed buyer, address token, uint256 amount);
event EscrowReleased(uint256 indexed escrowId, address indexed seller, uint256 amount);
event EscrowCancelled(uint256 indexed escrowId);
event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);
event ProtocolWalletUpdated(address indexed oldWallet, address indexed newWallet);
```

---

## 💳 Payment Flow

### Flow 1: Fiat Payment (Xendit)

```mermaid
sequenceDiagram
    participant Seller
    participant Frontend
    participant Backend
    participant Xendit
    participant ProtocolWallet as Protocol Wallet
    participant Lisk
    participant Buyer

    Note over Seller: Seller creates escrow
    Seller->>Frontend: Open /create page
    Seller->>Lisk: createEscrow(token, amount, releaseTime)<br/>(Seller signs with wallet)
    Lisk-->>Seller: escrowId created
    Seller->>Backend: POST /api/escrow/create<br/>(Save metadata + txHash)
    Backend->>Backend: Store in PostgreSQL
    Backend-->>Seller: {id: "abc123", paymentUrl}
    
    Note over Buyer: Buyer pays with fiat
    Buyer->>Frontend: Open payment link (/pay/abc123)
    Frontend->>Backend: GET /api/escrow/abc123
    Backend-->>Frontend: Escrow details

    Buyer->>Frontend: Click "Pay Now"
    Frontend->>Backend: POST /api/escrow/abc123/create-invoice
    Backend->>Xendit: createInvoice(amount, currency)
    Xendit-->>Backend: {invoice_url, invoice_id}
    Backend->>Backend: Save invoice URL to DB
    Backend-->>Frontend: {invoice_url}
    
    Frontend->>Buyer: Redirect to Xendit checkout
    Buyer->>Xendit: Pay via QRIS/Bank Transfer
    Xendit->>Backend: POST /api/payment/xendit/callback<br/>{status: "PAID", external_id: "abc123"}
    
    Backend->>Backend: Verify signature
    Backend->>Backend: Generate buyerToken
    Backend->>Backend: Update DB: status=FUNDED
    
    Note over ProtocolWallet,Lisk: Protocol Wallet funds escrow
    Backend->>ProtocolWallet: Trigger funding
    ProtocolWallet->>Lisk: approve(VouchEscrow, amount)<br/>(ERC20 approval)
    ProtocolWallet->>Lisk: Transfer USDC/IDRX to escrow<br/>+ markFunded(escrowId, buyerAddress)
    Lisk-->>Backend: Transaction confirmed
    
    loop Status Polling
        Frontend->>Backend: POST /api/payment/check-status
        Backend-->>Frontend: {status: "FUNDED", buyerToken: "xxx"}
    end
    
    Frontend->>Buyer: Show "Payment Secured" + buyerToken
    
    Note over Seller: Ships item to buyer
    Seller->>Backend: POST /api/escrow/abc123/ship<br/>{proof: "tracking/photo"}
    Backend->>Backend: Update DB: status=SHIPPED
    Backend-->>Seller: {status: "SHIPPED"}
    Frontend->>Buyer: Show "Item Shipped" + Proof
    
    alt Buyer confirms delivery
        Buyer->>Frontend: Verify proof & Click "Release Funds"
        Frontend->>Backend: POST /api/escrow/abc123/confirm<br/>{buyerToken: "xxx"}
        Backend->>Backend: Verify buyerToken
        Backend->>ProtocolWallet: Trigger release
        ProtocolWallet->>Lisk: releaseFunds(escrowId)
        Lisk->>Seller: Transfer tokens to seller wallet
        Lisk-->>Backend: Transaction confirmed
        Backend-->>Frontend: {status: "RELEASED"}
        Frontend->>Buyer: Show "Payment Complete"
    else Timeout reached (buyer doesn't confirm)
        Note over Lisk: After releaseTime passes
        ProtocolWallet->>Lisk: releaseFunds(escrowId)<br/>(Auto-release)
        Lisk->>Seller: Transfer tokens to seller wallet
        Note over Seller: Seller receives funds automatically
    end
```

### Flow 2: Crypto Payment

```mermaid
sequenceDiagram
    participant Buyer
    participant Frontend
    participant Lisk
    participant Seller

    Buyer->>Frontend: Open payment link
    Frontend->>Lisk: getEscrow(escrowId)
    Lisk-->>Frontend: Escrow details

    Buyer->>Frontend: Click "Pay with Crypto"
    Frontend->>Frontend: Connect wallet
    Buyer->>Lisk: approve(escrowContract, amount)<br/>(ERC20 approval)
    Lisk-->>Frontend: Approval confirmed
    
    Buyer->>Lisk: fundEscrow(escrowId)
    Lisk->>Lisk: transferFrom(buyer, escrow, amount)
    Lisk->>Lisk: Set escrow.funded = true
    Lisk-->>Frontend: Escrow FUNDED
    
    Frontend->>Buyer: Show "Payment Secured"
    
    Note over Seller: Ships item to buyer
    Seller->>Frontend: Upload shipment proof
    Frontend->>Backend: POST /api/escrow/abc123/ship<br/>{proof}
    Backend->>Backend: Status = SHIPPED
    Frontend-->>Buyer: Show "Item Shipped" + Proof
    
    alt Buyer confirms delivery
        Buyer->>Lisk: releaseFunds(escrowId)
        Lisk->>Seller: Transfer tokens to seller wallet
        Lisk-->>Frontend: Transaction confirmed
        Frontend->>Buyer: Show "Payment Complete"
    else Timeout reached (buyer doesn't confirm)
        Note over Lisk: After releaseTime passes
        Seller->>Lisk: releaseFunds(escrowId)<br/>(Auto-release)
        Lisk->>Seller: Transfer tokens to seller wallet
        Note over Seller: Seller receives funds automatically
    end
```

### Auto-Release Mechanism

**Purpose:** Protects sellers from buyers who receive items but refuse to release funds.

**How It Works:**

1. **Seller sets timeout** when creating escrow (e.g., `releaseTime = now + 7 days`)
2. **Buyer receives item** and should call `releaseFunds()` to release payment
3. **If buyer doesn't release:**
   - After `releaseTime` passes, **anyone** can call `releaseFunds(escrowId)`
   - Smart contract checks: `block.timestamp >= releaseTime`
   - Funds automatically released to seller wallet

**Who Can Trigger Release:**

| Actor | Before Timeout | After Timeout |
|-------|----------------|---------------|
| **Buyer** | ✅ Yes (anytime) | ✅ Yes |
| **Protocol Wallet** | ❌ No | ✅ Yes |
| **Seller** | ❌ No | ✅ Yes |
| **Anyone** | ❌ No | ✅ Yes (public function) |

**Example Timeline:**

```
Day 0: Escrow created (releaseTime = Day 7)
Day 1: Buyer pays, escrow funded
Day 2: Seller ships item
Day 3: Buyer receives item
Day 4: Buyer can release funds ✅
Day 7: Timeout reached
Day 8: Anyone can trigger auto-release ✅
```

**Smart Contract Logic:**

```solidity
function releaseFunds(uint256 escrowId) external {
    Escrow storage escrow = escrows[escrowId];
    require(escrow.funded && !escrow.released, "Invalid state");
    
    // Buyer can release anytime
    // Others can only release after timeout
    require(
        msg.sender == escrow.buyer || 
        block.timestamp >= escrow.releaseTime,
        "Not authorized or timeout not reached"
    );
    
    escrow.released = true;
    IERC20(escrow.token).transfer(escrow.seller, escrow.amount);
}
```

---

## 📡 API Reference

### Base URL

- **Development:** `http://localhost:3002`
- **Production:** `https://vouch.pramadani.site`

### Authentication

No authentication required for read operations. Write operations (release funds) require a `buyerToken` obtained after payment.

### Escrow Endpoints

#### Create Escrow

> **Note:** This endpoint is called **after** the seller has already created the escrow on-chain by calling `createEscrow()` directly with their wallet. This endpoint only stores metadata and the transaction hash in the database.

```http
POST /api/escrow/create
Content-Type: application/json

{
  "itemName": "Nike Air Jordan 1 Retro",
  "itemDescription": "Size 42, brand new with box",
  "itemImage": "https://...",
  "amount": "250",
  "fiatCurrency": "USD",
  "releaseDuration": 604800,
  "sellerAddress": "0x...",
  "txHash": "0x..."
}
```

**Response:**
```json
{
  "id": "abc123",
  "escrowId": 0,
  "status": "CREATED",
  "paymentUrl": "https://vouch.vercel.app/pay/abc123"
}
```

#### Get Escrow

```http
GET /api/escrow/:id
```

**Response:**
```json
{
  "id": "abc123",
  "escrowId": 0,
  "itemName": "Nike Air Jordan 1 Retro",
  "amountUsdc": "250000000",
  "amountIdr": "250000",
  "fiatCurrency": "USD",
  "status": "FUNDED",
  "sellerAddress": "0x123...",
  "buyerAddress": "0x456...",
  "xenditInvoiceUrl": "https://checkout.xendit.co/...",
  "createdAt": "2026-01-10T12:00:00Z"
}
```

#### Get Seller Escrows

```http
GET /api/escrow/seller/:address
```

**Response:**
```json
[
  {
    "id": "abc123",
    "itemName": "Nike Air Jordan",
    "status": "FUNDED",
    "amountIdr": "250000",
    "createdAt": "2026-01-10T12:00:00Z"
  },
  ...
]
```

#### Create Payment Invoice

```http
POST /api/escrow/:id/create-invoice
Content-Type: application/json

{
  "payerEmail": "buyer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "invoiceUrl": "https://checkout.xendit.co/web/...",
  "invoiceId": "inv_123..."
}
```

#### Release Funds

```http
POST /api/escrow/:id/release
Content-Type: application/json

{
  "buyerToken": "a1b2c3d4e5f6..."
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "status": "RELEASED"
}
```

#### Get On-Chain Status

```http
GET /api/escrow/:id/on-chain-status
```

**Response:**
```json
{
  "escrowId": 0,
  "seller": "0x123...",
  "buyer": "0x456...",
  "amount": "250000000",
  "funded": true,
  "released": false,
  "status": "FUNDED"
}
```

### Payment Endpoints

#### Xendit Webhook

```http
POST /api/payment/xendit/callback
X-Callback-Token: <signature>
Content-Type: application/json

{
  "id": "inv_123...",
  "external_id": "abc123",
  "status": "PAID",
  "amount": 250000,
  "paid_at": "2026-01-10T12:05:00Z"
}
```

#### Check Payment Status

```http
POST /api/payment/check-status
Content-Type: application/json

{
  "escrowId": "abc123"
}
```

**Response:**
```json
{
  "success": true,
  "status": "FUNDED",
  "buyerToken": "a1b2c3d4e5f6..."
}
```

#### Simulate Payment (Dev Only)

```http
POST /api/payment/simulate/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Payment simulated successfully",
  "buyerToken": "a1b2c3d4e5f6..."
}
```

### Faucet Endpoints

#### Request Tokens

```http
POST /api/faucet
Content-Type: application/json

{
  "address": "0x...",
  "type": "usdc"
}
```

**Types:** `eth`, `usdc`, `idrx`

**Response:**
```json
{
  "success": true,
  "type": "usdc",
  "amount": "1000",
  "txHash": "0x..."
}
```

---

## 🧩 Frontend Components

### Page Components

| Component | Path | Description |
|-----------|------|-------------|
| `Landing` | `/` | Hero, benefits, how it works, FAQ |
| `CreateEscrow` | `/create` | Seller creates payment link (wallet required) |
| `PaymentPage` | `/pay/[id]` | Buyer payment interface |
| `Dashboard` | `/dashboard` | Seller views all escrows |
| `Faucet` | `/faucet` | Testnet token faucet |
| `PitchDeck` | `/deck` | 15-slide presentation |
| `DemoSeller` | `/demo/seller` | Seller POV chat simulation |
| `DemoBuyer` | `/demo/buyer` | Buyer POV chat simulation |
| `Thumbnail` | `/demo/thumbnail` | YouTube thumbnail generator |

### UI Components

| Component | Purpose |
|-----------|---------|
| `Hero` | Landing page hero with animated chat simulation |
| `Header` | Site navigation with wallet connect |
| `Footer` | Links, social media, copyright |
| `Benefits` | 3-column benefits grid |
| `HowItWorks` | 4-step process visualization |
| `ProblemSolution` | Problem/solution comparison cards |
| `SocialProof` | Trust badges and logos |
| `Testimonials` | User testimonial slider |
| `FAQ` | Collapsible Q&A accordion |
| `CTASection` | Call-to-action with button |
| `Button` | Reusable button with variants |
| `Reveal` | Scroll animation wrapper (Intersection Observer) |
| `DemoChatPhone` | Instagram-style phone mockup with chat animation |

---

## ⚙️ Backend Services

### Database Service (`lib/db.ts`)

Prisma-based database operations:

```typescript
// Create escrow
async function createEscrow(data: CreateEscrowInput): Promise<Escrow>

// Get escrow by ID
async function getEscrowById(id: string): Promise<Escrow | null>

// Get seller's escrows
async function getEscrowsBySeller(address: string): Promise<Escrow[]>

// Mark escrow as funded
async function markEscrowFunded(id: string, invoiceId: string, buyerToken: string): Promise<void>

// Update escrow status
async function updateEscrowStatus(id: string, status: EscrowStatus): Promise<void>
```

### Wallet Service (`lib/wallet.ts`)

Protocol hot wallet management:

```typescript
class WalletManager {
  // Get escrow details from blockchain
  async getEscrowDetails(escrowId: number): Promise<EscrowDetails>
  
  // Mark escrow as funded on-chain
  async markFunded(escrowId: number, token: string, amount: string): Promise<string>
  
  // Release funds to seller
  async releaseFunds(escrowId: number): Promise<string>
  
  // Check on-chain status
  async getOnChainStatus(escrowId: number): Promise<OnChainStatus>
}
```

### Xendit Service (`lib/xendit.ts`)

Payment gateway integration:

```typescript
class XenditClient {
  // Create payment invoice
  async createInvoice(params: CreateInvoiceParams): Promise<XenditInvoice>
  
  // Get invoice status
  async getInvoice(invoiceId: string): Promise<XenditInvoice>
  
  // Verify webhook signature
  verifyCallback(payload: any, signature: string): boolean
  
  // Simulate payment (mock mode)
  simulatePaymentSuccess(invoiceId: string): XenditInvoice | null
}
```

---

## 🔧 Environment Variables

### Frontend (`.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://vouch.pramadani.site` |
| `NEXT_PUBLIC_LISK_CHAIN_ID` | Lisk chain ID | `4202` |

### Backend (`server/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/vouch` |
| `PORT` | ❌ | Server port | `3002` |
| `NODE_ENV` | ❌ | Environment | `production` |
| `PRIVATE_KEY` | ✅ | Protocol wallet private key | `0x...` |
| `LISK_RPC_URL` | ❌ | Lisk RPC endpoint | `https://rpc.sepolia-api.lisk.com` |
| `MOCK_USDC_ADDRESS` | ✅ | MockUSDC contract address | `0xB7c...` |
| `MOCK_IDRX_ADDRESS` | ✅ | MockIDRX contract address | `0xDfe...` |
| `VOUCH_ESCROW_ADDRESS` | ✅ | VouchEscrow contract address | `0xb01...` |
| `XENDIT_SECRET_KEY` | ❌ | Xendit API key (for real payments) | `xnd_...` |
| `XENDIT_CALLBACK_TOKEN` | ❌ | Xendit webhook verification token | `...` |
| `FRONTEND_URL` | ✅ | CORS allowed origin | `https://vouch.vercel.app` |

---

## 📁 Project Structure

```
vouch/
├── 📱 Frontend
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page
│   │   ├── layout.tsx                # Root layout + providers
│   │   ├── globals.css               # Global styles
│   │   ├── create/
│   │   │   └── page.tsx              # Seller: Create escrow
│   │   ├── pay/[id]/
│   │   │   └── page.tsx              # Buyer: Payment page
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Seller: Dashboard
│   │   ├── faucet/
│   │   │   └── page.tsx              # Testnet faucet
│   │   ├── deck/
│   │   │   └── page.tsx              # Pitch deck (15 slides)
│   │   └── demo/
│   │       ├── seller/page.tsx       # Seller chat demo
│   │       ├── buyer/page.tsx        # Buyer chat demo
│   │       └── thumbnail/page.tsx    # Thumbnail generator
│   │
│   ├── components/
│   │   ├── Hero.tsx                  # Landing hero section
│   │   ├── Header.tsx                # Navigation bar
│   │   ├── Footer.tsx                # Site footer
│   │   ├── Benefits.tsx              # Benefits grid
│   │   ├── HowItWorks.tsx            # Process steps
│   │   ├── ProblemSolution.tsx       # Problem/solution cards
│   │   ├── SocialProof.tsx           # Trust badges
│   │   ├── Testimonials.tsx          # User testimonials
│   │   ├── FAQ.tsx                   # FAQ accordion
│   │   ├── CTASection.tsx            # Call-to-action
│   │   ├── Button.tsx                # Reusable button
│   │   ├── Reveal.tsx                # Scroll animation
│   │   ├── Providers.tsx             # wagmi providers
│   │   ├── demo/
│   │   │   └── DemoChatPhone.tsx     # Phone mockup
│   │   └── ui/
│   │       └── FadeIn.tsx            # Fade animation
│   │
│   ├── lib/
│   │   ├── wagmi.ts                  # Wallet config
│   │   ├── contracts.ts              # Contract ABIs
│   │   ├── api.ts                    # API client
│   │   └── utils.ts                  # Utilities
│   │
│   ├── public/
│   │   ├── logo.png                  # Vouch logo
│   │   ├── lisk.png                  # Lisk logo
│   │   └── grid.svg                  # Background
│   │
│   ├── .env.local.example            # Frontend env template
│   ├── next.config.ts                # Next.js config
│   ├── tailwind.config.js            # Tailwind config
│   ├── tsconfig.json                 # TypeScript config
│   └── package.json                  # Dependencies
│
├── ⛓️ Smart Contracts
│   └── contracts/
│       ├── src/
│       │   ├── VouchEscrow.sol       # Main escrow logic
│       │   ├── MockUSDC.sol          # Test USDC
│       │   └── MockIDRX.sol          # Test IDRX
│       ├── script/
│       │   ├── Deploy.s.sol          # Deployment script
│       │   ├── DeployAll.s.sol       # Deploy all
│       │   └── DeployIDRX.s.sol      # Deploy IDRX
│       ├── foundry.toml              # Foundry config
│       └── .gitignore                # Ignore build artifacts
│
└── 🖥️ Backend
    └── server/
        ├── src/
        │   ├── index.ts              # Express app
        │   ├── lib/
        │   │   ├── db.ts             # Prisma operations
        │   │   ├── wallet.ts         # Hot wallet manager
        │   │   └── xendit.ts         # Xendit client
        │   └── routes/
        │       ├── escrow.ts         # Escrow CRUD
        │       ├── payment.ts        # Payment/webhooks
        │       └── faucet.ts         # Token faucet
        │
        ├── prisma/
        │   ├── schema.prisma         # Database schema
        │   └── migrations/           # Migration history
        │
        ├── ecosystem.config.js       # PM2 config
        ├── nginx.conf                # Nginx template
        ├── DEPLOYMENT.md             # VPS deployment guide
        ├── .env.example              # Backend env template
        └── package.json              # Dependencies
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ (for backend)
- **MetaMask** browser extension
- **Git**

### 1. Clone Repository

```bash
git clone https://github.com/pramadanif/vouch.git
cd vouch
```

### 2. Setup Frontend

```bash
# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Edit with your backend URL
nano .env.local
```

**.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_LISK_CHAIN_ID=4202
```

```bash
# Start development server
npm run dev
```

### 3. Setup Backend

```bash
cd server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit with your credentials
nano .env
```

**server/.env:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vouch"
PORT=3002
PRIVATE_KEY=0x_your_wallet_private_key
FRONTEND_URL=http://localhost:3000
```

```bash
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

### 4. Access Application

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:3002/health
- **Prisma Studio:** http://localhost:5555 (run `npx prisma studio`)

---

## 💻 Development

### Running Tests

```bash
# Frontend tests (if implemented)
npm run test

# Backend tests (if implemented)
cd server && npm run test
```

### Building for Production

```bash
# Frontend
npm run build
npm run start

# Backend
cd server
npm run build
npm run start
```

### Code Quality

```bash
# TypeScript type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

---

## ☁️ Deployment

### Frontend Deployment (Vercel)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "feat: ready for deployment"
   git push origin main
   ```

2. **Import to Vercel:**
   - Visit [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Framework: Next.js
   - Root directory: `./`

3. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://vouch.pramadani.site
   NEXT_PUBLIC_LISK_CHAIN_ID=4202
   ```

4. **Deploy:**
   Click "Deploy" → Your site is live!

### Backend Deployment (VPS)

See [server/DEPLOYMENT.md](server/DEPLOYMENT.md) for the complete guide.

**Quick Deploy:**

```bash
# On VPS
cd ~/apps/vouch/server

# Install & build
npm install
npm run build

# Setup database
npx prisma generate
npx prisma db push

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Setup Nginx
sudo cp nginx.conf /etc/nginx/sites-available/vouch-api
sudo ln -s /etc/nginx/sites-available/vouch-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL Certificate
sudo certbot --nginx -d vouch.pramadani.site
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Seller can connect wallet
- [ ] Seller can create escrow
- [ ] Payment link is shareable
- [ ] Buyer can pay via Xendit (mock mode)
- [ ] Funds show as "secured" after payment
- [ ] Buyer can release funds
- [ ] Seller receives funds in wallet
- [ ] Dashboard shows all escrows
- [ ] Faucet distributes tokens

### Smart Contract Testing

```bash
cd contracts

# Run tests
forge test

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

---

## 🔍 Troubleshooting

### Common Issues

#### "Cannot connect to MetaMask"

**Solution:** Ensure MetaMask is installed and Lisk Sepolia network is added:
```javascript
Network Name: Lisk Sepolia
RPC URL: https://rpc.sepolia-api.lisk.com
Chain ID: 4202
Currency Symbol: ETH
```

#### "Transaction failed: insufficient funds"

**Solution:** Get testnet ETH from [Lisk Sepolia Faucet](https://sepolia-faucet.lisk.com) or use `/faucet` page.

#### "Xendit callback not received"

**Causes:**
- Webhook URL not configured in Xendit dashboard
- Callback token mismatch
- Firewall blocking Xendit IPs

**Solution:**
1. Add webhook URL in Xendit: `https://vouch.pramadani.site/api/payment/xendit/callback`
2. Verify `XENDIT_CALLBACK_TOKEN` matches dashboard
3. Check server logs: `pm2 logs vouch-server`

#### "Database connection failed"

**Solution:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U postgres -d vouch

# Fix pg_hba.conf if needed
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Change "peer" to "md5"
sudo systemctl restart postgresql
```

#### "Contract call reverted"

**Common Causes:**
- Insufficient token approval
- Escrow already funded/released
- Incorrect escrow ID
- Timeout not reached (for auto-release)

**Debug:**
Check transaction on [Lisk Sepolia Explorer](https://sepolia-blockscout.lisk.com)

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new payment method
fix: resolve wallet connection issue
docs: update README with deployment guide
chore: update dependencies
```

---

## 📦 Tech Stack

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Utility-first CSS |
| Framer Motion | 11.x | Animations |
| wagmi | 2.x | Wallet connection |
| viem | 2.x | Ethereum interactions |
| React Query | 5.x | Data fetching |

### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Express.js | 4.x | Web framework |
| TypeScript | 5.x | Type safety |
| Prisma | 5.x | ORM |
| PostgreSQL | 14+ | Database |
| Ethers.js | 6.x | Blockchain interactions |
| Xendit SDK | - | Payment gateway |

### Smart Contract Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Solidity | 0.8.20 | Contract language |
| Foundry | Latest | Development framework |
| OpenZeppelin | 5.x | Security libraries |
| Lisk | Sepolia | EVM-compatible L2 |

### DevOps Stack

| Technology | Purpose |
|------------|---------|
| Vercel | Frontend hosting |
| PM2 | Process management |
| Nginx | Reverse proxy |
| Certbot | SSL certificates |
| PostgreSQL | Production database |

---

## 🛡️ Security

### Smart Contract Security

- **Audited Patterns:** Uses OpenZeppelin's battle-tested libraries
- **Reentrancy Protection:** `ReentrancyGuard` on all state-changing functions
- **Access Control:** `onlyProtocol` modifier for sensitive operations
- **Seller Verification:** `msg.sender = seller` proves ownership
- **SafeERC20:** Prevents token transfer failures

### Backend Security

- **Buyer Token:** 64-character random token for release authorization
- **Webhook Verification:** Xendit signature validation
- **CORS:** Strict origin whitelist
- **Environment Variables:** Secrets never committed to Git
- **SQL Injection:** Prisma ORM prevents SQL injection
- **Input Validation:** All user inputs sanitized

### Trust Model

```
┌─────────────────────────────────────────────────────────┐
│              ON-CHAIN (Immutable & Trustless)            │
├─────────────────────────────────────────────────────────┤
│  ✓ Escrow creation (seller = msg.sender)                │
│  ✓ Fund locking (smart contract holds tokens)           │
│  ✓ Release logic (buyer confirms OR timeout)            │
│  ✓ Refund logic (dispute resolution)                    │
│  ✓ Timeout protection (auto-release after deadline)     │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ Verifiable on blockchain
                          │
┌─────────────────────────────────────────────────────────┐
│            OFF-CHAIN (Replaceable & Convenient)          │
├─────────────────────────────────────────────────────────┤
│  • Fiat payment confirmation (Xendit webhook)           │
│  • Metadata storage (PostgreSQL)                        │
│  • UI/UX (Next.js frontend)                             │
│  • Email notifications (future)                         │
└─────────────────────────────────────────────────────────┘
```

> **Critical Security Property:** If the backend disappears tomorrow, funds remain safe in the smart contract. Seller and buyer can still interact directly with the contract on Lisk.

---

## 🗺️ Roadmap

### Phase 1: MVP ✅ (Current)

- [x] Smart contract deployment on Lisk Sepolia
- [x] Fiat payment via Xendit (QRIS, Bank Transfer)
- [x] Crypto payment (USDC/IDRX)
- [x] Seller dashboard
- [x] Buyer payment page
- [x] Landing page with docs

### Phase 2: Mainnet Launch 🚀

- [ ] Audit smart contracts
- [ ] Deploy to Lisk mainnet
- [ ] Real Xendit integration (production keys)
- [ ] Multi-currency support (PHP, THB, VND)
- [ ] Email notifications
- [ ] WhatsApp integration

### Phase 3: Scale 📈

- [ ] Seller analytics dashboard
- [ ] Dispute resolution system
- [ ] Escrow templates
- [ ] API for third-party integrations
- [ ] Mobile app (React Native)
- [ ] Multi-chain support (Polygon, Base)

### Phase 4: Ecosystem 🌐

- [ ] Vouch SDK for e-commerce platforms
- [ ] Shopify plugin
- [ ] Browser extension
- [ ] Reputation system
- [ ] Vouch DAO governance

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ for the Lisk Hackathon</strong><br/>
  <em>Vouch doesn't replace marketplaces.<br/>It replaces the missing trust layer in social commerce.</em>
</p>

<p align="center">
  <a href="https://vouch.vercel.app">Website</a> •
  <a href="https://github.com/pramadanif/vouch">GitHub</a> •
  <a href="https://vouch.pramadani.site/health">API Status</a>
</p>
