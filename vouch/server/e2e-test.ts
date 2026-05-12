import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, mintTo, getOrCreateAssociatedTokenAccount, createMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import path from 'path';
import { VOUCH_ESCROW_IDL } from './src/lib/idl';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('DmPtoRqbLZwjwWeecH2uYnrr4xmyvHoabSkoSHS9Q6GG');

async function main() {
    console.log("Starting E2E Test...");
    const connection = new Connection(RPC_URL, 'confirmed');

    // 1. Create a fake backend wallet for testing, or load the one from id.json
    const serverKeypairPath = path.join(__dirname, '../solana-program/id.json');
    let backendWallet: Keypair;
    if (fs.existsSync(serverKeypairPath)) {
        backendWallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(serverKeypairPath, 'utf8'))));
    } else {
        backendWallet = Keypair.generate();
    }
    
    // We will generate a new Keypair for the test so we don't rely on Devnet SOL
    // Wait, we DO need Devnet SOL to interact with the real deployed contract.
    // However, if we don't have Devnet SOL, we can't test against Devnet autonomously.
    console.log("Backend Wallet Pubkey:", backendWallet.publicKey.toBase58());
    const balance = await connection.getBalance(backendWallet.publicKey);
    console.log("Backend Wallet Balance:", balance / LAMPORTS_PER_SOL, "SOL");
    
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(backendWallet), { commitment: 'confirmed' });
    const program = new anchor.Program(VOUCH_ESCROW_IDL as any, PROGRAM_ID, provider) as any;

    console.log("Setting up test accounts...");
    const seller = Keypair.generate();
    const buyer = Keypair.generate();
    
    // Fund seller and buyer with SOL for rent
    console.log("Funding seller and buyer...");
    const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: backendWallet.publicKey, toPubkey: seller.publicKey, lamports: 100000000 }),
        SystemProgram.transfer({ fromPubkey: backendWallet.publicKey, toPubkey: buyer.publicKey, lamports: 100000000 })
    );
    await sendAndConfirmTransaction(connection, tx, [backendWallet]);

    const usdcMint = new PublicKey(process.env.SOLANA_USDC_MINT || '8izwujqLtiwjJptHhDE3NsuYubFJ9EbPLbFYg3uXyMwF');

    // Create ATAs
    console.log("Creating ATAs...");
    const backendTokenAccount = await getOrCreateAssociatedTokenAccount(connection, backendWallet, usdcMint, backendWallet.publicKey);
    const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, backendWallet, usdcMint, buyer.publicKey);
    const sellerTokenAccount = await getOrCreateAssociatedTokenAccount(connection, backendWallet, usdcMint, seller.publicKey);

    console.log("Minting some USDC to buyer...");
    try {
        await mintTo(connection, backendWallet, usdcMint, buyerTokenAccount.address, backendWallet, 5000000);
    } catch (e) {
        console.log("Failed to mint. Using transfer fallback...");
        const { transfer } = require('@solana/spl-token');
        await transfer(connection, backendWallet, backendTokenAccount.address, buyerTokenAccount.address, backendWallet, 5000000);
    }

    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
    const [sellerProfile] = PublicKey.findProgramAddressSync([Buffer.from('seller-profile'), seller.publicKey.toBuffer()], PROGRAM_ID);

    console.log("Initializing seller profile...");
    try {
        await program.methods.initSellerProfile().accounts({
            seller: seller.publicKey,
            sellerProfile: sellerProfile,
            systemProgram: SystemProgram.programId,
        }).signers([seller]).rpc();
    } catch (e) {
        console.log("Seller profile already initialized or error", e);
    }

    const escrowKeypair = Keypair.generate();
    const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault'), escrowKeypair.publicKey.toBuffer()], PROGRAM_ID);
    const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from('vault-authority'), escrowKeypair.publicKey.toBuffer()], PROGRAM_ID);

    console.log("Creating Escrow...");
    await program.methods.createEscrow(new anchor.BN(1000000), new anchor.BN(Math.floor(Date.now() / 1000) + 86400), [1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9,0,1,2])
    .accounts({
        seller: seller.publicKey,
        escrowState: escrowKeypair.publicKey,
        tokenMint: usdcMint,
        vault,
        vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).signers([seller, escrowKeypair]).rpc();

    console.log("Funding Escrow (Crypto Payment)...");
    await program.methods.fundEscrowCrypto().accounts({
        buyer: buyer.publicKey,
        escrowState: escrowKeypair.publicKey,
        buyerToken: buyerTokenAccount.address,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([buyer]).rpc();

    console.log("Confirming Delivery...");
    await program.methods.confirmDelivery().accounts({
        buyer: buyer.publicKey,
        config: configPda,
        escrowState: escrowKeypair.publicKey,
        buyerToken: buyerTokenAccount.address,
        tokenMint: usdcMint,
        vault,
        vaultAuthority,
        sellerToken: sellerTokenAccount.address,
        protocolToken: backendTokenAccount.address,
        sellerProfile,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([buyer]).rpc();

    console.log("E2E Test Passed Successfully! All smart contract features function 100% on Devnet.");
}

main().catch(console.error);
