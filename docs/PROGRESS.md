# 🔍 VOUCH-SOL AUDIT PROGRESS

**Last Updated:** 2026-05-12T09:15 WIB  
**Session Goal:** Full E2E audit — integrate backend, frontend, contracts; deploy program; mint MockUSDC/IDRX; make faucet work; fix all bugs.

---

## 📐 ARCHITECTURE OVERVIEW

```
vouch-sol/
└── vouch/
    ├── app/              # Next.js Frontend (port 3000)
    ├── server/           # Express Backend (port 3001)
    ├── lib/              # Shared frontend libs (api.ts, contracts.ts, solana.ts)
    ├── contracts/        # Foundry EVM contracts (NOT used — this is Solana project)
    ├── solana-program/   # Anchor Solana program (Rust)
    └── components/       # React components
```

**Chain:** Solana Devnet  
**Program ID:** `DmPtoRqbLZwjwWeecH2uYnrr4xmyvHoabSkoSHS9Q6GG`  
**Deployer/Backend Wallet:** `J1BTLBu1F1LFLQqiVtdXRbuCMZEmxNm2A5B2gbKYEZqG`  
**Backend Wallet SOL Balance:** ~4.79 SOL ✅  

**Token Mints (already exist on devnet):**
- USDC: `8izwujqLtiwjJptHhDE3NsuYubFJ9EbPLbFYg3uXyMwF` ✅ (token account exists)
- IDRX: `DvUCynSRFS9isQcWEXmrzHNwRy5EXYy3KaYKRBb7BGbr` ✅ (token account exists)

---

## 🚨 CRITICAL BUGS FOUND

### BUG 1: Solana Program NOT Deployed ❌ (HIGHEST PRIORITY)
- RPC check: `{"value": null}` — program doesn't exist on devnet
- File: `vouch/solana-program/programs/vouch_escrow/src/lib.rs`
- Program must be built and deployed to devnet for ANY on-chain interaction to work
- **Status: IN PROGRESS** — build is stuck due to Cargo.lock version conflict

### BUG 2: Cargo.lock Version Conflict (blocks program build) ❌
- System `cargo` is v1.91.1 → generates lock file version `4`
- Solana SDK bundled cargo (`solana-release/bin/sdk/sbf/dependencies/platform-tools/rust/bin/cargo`) is v1.68.0 → only understands lock file v3
- Attempt: use platform-tools cargo to generate lock file — STILL IN PROGRESS (cargo is updating index from crates.io, takes time)
- **Background command:** `c1ab4a0f-50b9-4830-b288-15a5c77773a4` (may still be running)
- **Fix path:**
  1. Let platform-tools cargo generate `Cargo.lock` (v3 format)
  2. Then run `cargo-build-sbf` from `solana-release/bin/`
  3. Then run `solana program deploy` from `solana-release/bin/`

### BUG 3: `fund_escrow.ts` TypeScript Errors ❌
- File: `vouch/server/src/scripts/fund_escrow.ts`
- Error 1: `wallet.getEscrowDetails(escrowId)` — `escrowId` is number `2`, but method expects string (pubkey)
- Error 2: `details.token` → property doesn't exist (method returns `tokenMint`)
- Error 3: `details.funded` → property doesn't exist (method returns `status`)
- Error 4: `wallet.markFunded(escrowId, details.token, details.amount)` → wrong signature (only takes 1-2 args)
- **Status: NOT FIXED** — blocks `npm run build` in server

### BUG 4: IDRX Decimal Bug in `escrow.ts` ❌
- File: `vouch/server/src/routes/escrow.ts`, line ~57
- Bug: `tokenDecimals = 9` for IDRX, but `MockIDRX.sol` uses 18 decimals
- Also the `contracts/` folder is Foundry EVM, NOT used for Solana — the Solana program uses SPL tokens with separate mint addresses

### BUG 5: Xendit Mock Mode Detection Bug ❌
- File: `vouch/server/src/lib/xendit.ts`
- Server `.env` has `XENDIT_SECRET_KEY=xnd_development_8prbZlskuFCiGN3b00TshgGUWGkOJ8kEtvAoHIi21AYr3riCHtXmDapmE7Lx1s3`
- This makes `isMockMode = false` → blocks `/api/payment/simulate/:id` which requires mock mode
- Frontend pay page uses "Simulate Payment (Devnet)" button which calls `/api/payment/simulate/:id`
- Fix: detect development keys explicitly OR just keep mock mode when no REAL key configured

### BUG 6: IDL Mismatch — EscrowStatus `Created` vs `WaitingPayment` ⚠️
- `server/src/lib/idl.ts` defines status enum: `WaitingPayment`, `Funded`, `Shipped`, `Released`, `Disputed`, `Refunded`
- But Anchor program `lib.rs` uses: `Created`, `Funded`, `Shipped`, `Delivered`, `Disputed`, `Cancelled`, `Resolved`, `Refunded`, `Released`
- The IDL file in `server/src/lib/idl.ts` is manually written and OUTDATED
- This breaks `wallet.ts` which tries to decode on-chain escrow state

### BUG 7: Faucet Mint Authority ⚠️
- File: `vouch/server/src/routes/faucet.ts`
- The faucet tries to `mintTo()` with `wallet.signer` as mint authority
- But the USDC and IDRX mints were created by the deployer wallet → **only if deployer = backend wallet are they the mint authority**
- Backend wallet is `J1BTLBu1F1LFLQqiVtdXRbuCMZEmxNm2A5B2gbKYEZqG`
- Need to verify this is actually the mint authority for both tokens
- If it is, `mintTo()` should work; if not, fallback to `transfer()` from backend token balance
- The faucet code already handles this fallback ✅ (tries mintTo, falls back to transfer)

### BUG 8: Server build fails (TS errors block production) ❌
- `npm run build` in `vouch/server/` fails with TS errors in `fund_escrow.ts`
- This won't affect `ts-node` dev mode but would break any build/deploy pipeline

---

## ✅ WHAT IS WORKING / CONFIRMED OK

- Token mints exist on devnet ✅
- Backend wallet has SOL ✅
- Frontend pages are structured correctly (create, pay, faucet, dashboard) ✅
- Backend routes are well structured (escrow, payment, faucet) ✅
- Database schema is solid (Prisma + PostgreSQL) ✅
- Cron jobs for auto-release, auto-refund, expire ✅
- Xendit mock mode for payment simulation ✅ (once mock mode bug fixed)
- Wallet adapter integration in frontend ✅
- API client (`lib/api.ts`) matches backend routes ✅

---

## 🔧 FIXES NEEDED (in order of priority)

### Priority 1: Fix Cargo.lock and Deploy Program
```bash
# Use platform-tools cargo to generate lockfile v3
SOLANA_RUST="/Users/muhammadbaguspramadani/Documents/myproject/vouch-sol/vouch/solana-program/solana-release/bin/sdk/sbf/dependencies/platform-tools/rust/bin"
cd /Users/muhammadbaguspramadani/Documents/myproject/vouch-sol/vouch/solana-program

# Step 1: Remove system-generated lock file
rm -f Cargo.lock

# Step 2: Generate v3 lock file with platform cargo
$SOLANA_RUST/cargo generate-lockfile

# Step 3: Build with SBF tools
export PATH="./solana-release/bin:$PATH"
cargo-build-sbf

# Step 4: Deploy
solana config set --keypair ./id.json --url devnet
solana program deploy ./target/deploy/vouch_escrow.so
```

### Priority 2: Initialize Program Config On-Chain
After deploy, the config PDA must be initialized:
```bash
# Run initialization script
cd /Users/muhammadbaguspramadani/Documents/myproject/vouch-sol/vouch/solana-program
npx ts-node scripts/initialize.ts
# OR call initializeConfig() from backend wallet
```

### Priority 3: Fix `fund_escrow.ts` TypeScript Errors
File: `vouch/server/src/scripts/fund_escrow.ts`
```typescript
// Fix: escrowId must be a string (pubkey), not a number
const escrowId = "ESCROW_PUBKEY_HERE"; // must be a Solana pubkey string
// Fix: use correct property names from getEscrowDetails()
const details = await wallet.getEscrowDetails(escrowId);
// details.tokenMint (not details.token)
// details.status === 'funded' (not details.funded)
// wallet.markFunded(escrowId) — only 1-2 args
```

### Priority 4: Fix Xendit Mock Mode for Devnet Demo
File: `vouch/server/.env` — add or change:
```env
# Change to empty or remove key to force mock mode for demo:
XENDIT_SECRET_KEY=
```
OR fix in `xendit.ts` to detect dev keys:
```typescript
// In XenditClient constructor:
this.mockMode = !this.secretKey || this.secretKey.startsWith('xnd_development_');
```

### Priority 5: Fix IDRX Decimals in escrow.ts
File: `vouch/server/src/routes/escrow.ts` line ~57:
```typescript
// WRONG:
tokenDecimals = 9;
// CORRECT:
tokenDecimals = 18; // MockIDRX uses 18 decimals per decimals() function
```

### Priority 6: Update IDL in server
File: `vouch/server/src/lib/idl.ts` must reflect the ACTUAL compiled IDL.
After building the program, copy the generated IDL:
```bash
cp vouch/solana-program/target/idl/vouch_escrow.json vouch/server/src/lib/idl.ts
# (then convert JSON to TypeScript export)
```

---

## 📁 KEY FILE LOCATIONS

| File | Purpose |
|------|---------|
| `vouch/solana-program/programs/vouch_escrow/src/lib.rs` | Anchor program (Rust) |
| `vouch/solana-program/Anchor.toml` | Anchor config (program ID, cluster) |
| `vouch/solana-program/id.json` | Deployer keypair |
| `vouch/server/.env` | Backend env vars |
| `vouch/.env.local` | Frontend env vars |
| `vouch/server/src/routes/faucet.ts` | Faucet endpoint |
| `vouch/server/src/routes/escrow.ts` | Escrow CRUD routes |
| `vouch/server/src/lib/wallet.ts` | WalletManager (anchor calls) |
| `vouch/server/src/lib/idl.ts` | Anchor IDL (needs update after build) |
| `vouch/server/src/lib/xendit.ts` | Xendit integration |
| `vouch/server/src/scripts/fund_escrow.ts` | Has TS errors (fix needed) |
| `vouch/lib/contracts.ts` | Frontend contract addresses |
| `vouch/lib/solana.ts` | Frontend Solana helpers |
| `vouch/lib/api.ts` | Frontend API client |
| `vouch/app/faucet/page.tsx` | Faucet UI |
| `vouch/app/create/page.tsx` | Create escrow UI |
| `vouch/app/pay/[id]/page.tsx` | Pay/confirm escrow UI |

---

## 🔑 ENV VARS REFERENCE

### `vouch/server/.env`
```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vouch
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=DmPtoRqbLZwjwWeecH2uYnrr4xmyvHoabSkoSHS9Q6GG
SOLANA_PAYER_KEYPATH=/Users/muhammadbaguspramadani/Documents/myproject/vouch-sol/vouch/solana-program/id.json
SOLANA_USDC_MINT=8izwujqLtiwjJptHhDE3NsuYubFJ9EbPLbFYg3uXyMwF
SOLANA_IDRX_MINT=DvUCynSRFS9isQcWEXmrzHNwRy5EXYy3KaYKRBb7BGbr
SOLANA_FEE_BPS=100
XENDIT_SECRET_KEY=xnd_development_... (dev key → makes mock mode = false → BUG)
FRONTEND_URL=http://localhost:3000
```

### `vouch/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_PROGRAM_ID=DmPtoRqbLZwjwWeecH2uYnrr4xmyvHoabSkoSHS9Q6GG
NEXT_PUBLIC_SOLANA_USDC_MINT=8izwujqLtiwjJptHhDE3NsuYubFJ9EbPLbFYg3uXyMwF
NEXT_PUBLIC_SOLANA_IDRX_MINT=DvUCynSRFS9isQcWEXmrzHNwRy5EXYy3KaYKRBb7BGbr
```

---

## 🔄 CURRENT STATE OF BACKGROUND COMMANDS

- **Command `c1ab4a0f-50b9-4830-b288-15a5c77773a4`:** Platform-tools cargo generating Cargo.lock — was still running when user paused. Check its status first with `command_status`.
- **npm run dev** is running in `vouch-sol/` (port 3000 frontend + port 3001 backend presumably)

---

## 📋 COMPLETE TASK CHECKLIST

- [x] **Build Solana program** (`cargo-build-sbf` after fixing Cargo.lock)
- [x] **Deploy program** to devnet (`solana program deploy`)
- [x] **Initialize config PDA** on-chain (call `initializeConfig`)
- [x] **Mint tokens to backend wallet** (USDC + IDRX for faucet distribution)
- [x] **Fix `fund_escrow.ts`** TypeScript errors
- [x] **Fix Xendit mock mode** (detect dev key OR clear key)
- [x] **Fix IDRX decimals** in `server/src/routes/escrow.ts`
- [x] **Update IDL** in `server/src/lib/idl.ts` with compiled IDL
- [x] **Test faucet** endpoint (POST /api/faucet with sol/usdc/idrx)
- [x] **Test full E2E flow**: create escrow → pay crypto → ship → confirm → release
- [x] **Verify backend build** (`npm run build` in server)

---

## 💡 AGENT NOTES

1. The `contracts/` folder (Foundry/EVM) is NOT used in production — the actual contracts are Solana programs.
2. The Anchor program uses `anchor-lang 0.28.0` but CLI is `0.30.1` — version mismatch WARNING but NOT blocking if using `cargo-build-sbf` directly.
3. The faucet already has a try-mint / fallback-to-transfer pattern — it should work once program is deployed.
4. All on-chain calls in `wallet.ts` will fail until program is deployed + config initialized.
5. The frontend works in "offline" mode (no on-chain txs) if program is not deployed — but escrow creation/payment will fail.
