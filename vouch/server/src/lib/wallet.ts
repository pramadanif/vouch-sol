import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import * as fs from 'fs';
import path from 'path';

// Minimal IDL for internal use in the server
import { VOUCH_ESCROW_IDL } from './idl';

const IDL: any = {
    ...VOUCH_ESCROW_IDL
};

interface EscrowAccount {
    seller: PublicKey;
    buyer: PublicKey;
    tokenMint: PublicKey;
    amount: anchor.BN;
    releaseTime: anchor.BN;
    status: any;
    vaultBump: number;
    descriptionHash: number[];
}

function loadKeypair(): Keypair {
    const keyPath = process.env.SOLANA_PAYER_KEYPATH || path.join(process.cwd(), 'id.json');
    if (!fs.existsSync(keyPath)) {
        const newKeypair = Keypair.generate();
        fs.writeFileSync(keyPath, JSON.stringify(Array.from(newKeypair.secretKey)));
        return newKeypair;
    }
    const secretKey = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

export class WalletManager {
    private connection: Connection;
    private keypair: Keypair;
    private programId: PublicKey;
    private provider: anchor.AnchorProvider;
    private program: anchor.Program;
    private usdcMint: PublicKey;
    private idrxMint: PublicKey;

    constructor(rpcUrl: string, programId: string, usdcMint: string, idrxMint: string) {
        console.log('Initializing WalletManager with:', { rpcUrl, programId, usdcMint, idrxMint });
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.keypair = loadKeypair();
        this.programId = new PublicKey(programId);
        this.usdcMint = new PublicKey(usdcMint);
        this.idrxMint = new PublicKey(idrxMint);

        this.provider = new anchor.AnchorProvider(
            this.connection,
            new anchor.Wallet(this.keypair),
            { commitment: 'confirmed' }
        );

        this.program = new anchor.Program(IDL, this.programId, this.provider);

        console.log(`Solana wallet initialized: ${this.keypair.publicKey.toBase58()}`);
    }

    get address(): string {
        return this.keypair.publicKey.toBase58();
    }

    get signer(): Keypair {
        return this.keypair;
    }

    get usdcAddress(): string {
        return this.usdcMint.toBase58();
    }

    get idrxAddress(): string {
        return this.idrxMint.toBase58();
    }

    private configPda(): PublicKey {
        const [config] = PublicKey.findProgramAddressSync([Buffer.from('config')], this.programId);
        return config;
    }

    private sellerProfilePda(seller: PublicKey): PublicKey {
        const [profile] = PublicKey.findProgramAddressSync(
            [Buffer.from('seller-profile'), seller.toBuffer()],
            this.programId
        );
        return profile;
    }

    private vaultPda(escrow: PublicKey): PublicKey {
        const [vault] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault'), escrow.toBuffer()],
            this.programId
        );
        return vault;
    }

    private vaultAuthorityPda(escrow: PublicKey): PublicKey {
        const [vaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault-authority'), escrow.toBuffer()],
            this.programId
        );
        return vaultAuthority;
    }

    private async ensureConfig(): Promise<void> {
        const config = this.configPda();
        const info = await this.connection.getAccountInfo(config);
        if (info) return;

        const feeBps = Number(process.env.SOLANA_FEE_BPS || '100');
        await this.program.methods
            .initializeConfig(this.keypair.publicKey, feeBps)
            .accounts({
                config,
                payer: this.keypair.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            })
            .rpc();
    }

    async getEscrowDetails(escrowId: string): Promise<{
        seller: string;
        buyer: string;
        tokenMint: string;
        amount: string;
        releaseAt: number;
        status: string;
    }> {
        const escrow = await this.program.account.escrowState.fetch(new PublicKey(escrowId)) as any;
        return {
            seller: escrow.seller.toBase58(),
            buyer: escrow.buyer ? escrow.buyer.toBase58() : '',
            tokenMint: escrow.tokenMint.toBase58(),
            amount: escrow.amount.toString(),
            releaseAt: escrow.releaseTime.toNumber(),
            status: Object.keys(escrow.status)[0]
        };
    }

    async markFunded(escrowId: string, buyer?: string): Promise<string> {
        await this.ensureConfig();
        const escrowPubkey = new PublicKey(escrowId);
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as any;

        const tokenMint = escrow.tokenMint;
        const { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
        
        // Ensure protocol has an ATA to receive fees
        const protocolAta = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.keypair,
            tokenMint,
            this.keypair.publicKey
        );
        const protocolToken = protocolAta.address;
        
        const vault = this.vaultPda(escrowPubkey);
        const tx = await this.program.methods
            .markFunded(buyer ? new PublicKey(buyer) : new PublicKey('11111111111111111111111111111111'))
            .accounts({
                protocolWallet: this.keypair.publicKey,
                config: this.configPda(),
                escrowState: escrowPubkey,
                protocolToken,
                tokenMint,
                vault,
                tokenProgram: TOKEN_PROGRAM_ID
            })
            .rpc();

        return tx;
    }

    async markShipped(escrowId: string): Promise<string> {
        await this.ensureConfig();
        const escrowPubkey = new PublicKey(escrowId);
        const tx = await this.program.methods
            .markShipped()
            .accounts({
                caller: this.keypair.publicKey,
                config: this.configPda(),
                escrowState: escrowPubkey
            })
            .rpc();

        return tx;
    }

    async confirmDelivery(escrowId: string): Promise<string> {
        await this.ensureConfig();
        const escrowPubkey = new PublicKey(escrowId);
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as any;

        const tokenMint = escrow.tokenMint;
        const vault = this.vaultPda(escrowPubkey);
        const vaultAuthority = this.vaultAuthorityPda(escrowPubkey);
        
        const { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
        
        // Ensure seller has an ATA
        const sellerAta = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.keypair,
            tokenMint,
            escrow.seller
        );
        const sellerToken = sellerAta.address;

        // Ensure protocol has an ATA
        const protocolAta = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.keypair,
            tokenMint,
            this.keypair.publicKey
        );
        const protocolToken = protocolAta.address;

        // For mediated payments, the server wallet acts as the 'buyer' to sign confirmDelivery
        // but it doesn't need its own ATA since funds go from vault to seller/protocol
        const buyerToken = protocolToken; 

        const sellerProfile = this.sellerProfilePda(escrow.seller);

        const tx = await this.program.methods
            .confirmDelivery()
            .accounts({
                buyer: this.keypair.publicKey,
                config: this.configPda(),
                escrowState: escrowPubkey,
                buyerToken,
                tokenMint,
                vault,
                vaultAuthority,
                sellerToken,
                protocolToken,
                sellerProfile,
                tokenProgram: TOKEN_PROGRAM_ID
            })
            .rpc();

        return tx;
    }

    async releaseFunds(escrowId: string): Promise<string> {
        await this.ensureConfig();
        const escrowPubkey = new PublicKey(escrowId);
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as any;

        const tokenMint = escrow.tokenMint;
        const vault = this.vaultPda(escrowPubkey);
        const vaultAuthority = this.vaultAuthorityPda(escrowPubkey);
        
        const { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
        
        // Ensure seller has an ATA
        const sellerAta = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.keypair,
            tokenMint,
            escrow.seller
        );
        const sellerToken = sellerAta.address;

        // Ensure protocol has an ATA
        const protocolAta = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.keypair,
            tokenMint,
            this.keypair.publicKey
        );
        const protocolToken = protocolAta.address;

        const sellerProfile = this.sellerProfilePda(escrow.seller);

        const tx = await this.program.methods
            .releaseFunds()
            .accounts({
                protocolWallet: this.keypair.publicKey,
                config: this.configPda(),
                escrowState: escrowPubkey,
                tokenMint,
                vault,
                vaultAuthority,
                sellerToken,
                protocolToken,
                sellerProfile,
                tokenProgram: TOKEN_PROGRAM_ID
            })
            .rpc();

        return tx;
    }

    async closeEscrow(escrowId: string): Promise<string> {
        await this.ensureConfig();
        const escrowPubkey = new PublicKey(escrowId);
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as any;

        const tokenMint = escrow.tokenMint;
        const vault = this.vaultPda(escrowPubkey);
        const vaultAuthority = this.vaultAuthorityPda(escrowPubkey);
        const sellerToken = getAssociatedTokenAddressSync(tokenMint, escrow.seller);
        const protocolToken = getAssociatedTokenAddressSync(tokenMint, this.keypair.publicKey);

        const tx = await this.program.methods
            .closeEscrow()
            .accounts({
                protocolWallet: this.keypair.publicKey,
                config: this.configPda(),
                escrowState: escrowPubkey,
                vault,
                vaultAuthority,
                sellerToken,
                protocolToken,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID
            })
            .rpc();

        return tx;
    }

    async refundEscrow(escrowId: string): Promise<string> {
        await this.ensureConfig();
        const escrowPubkey = new PublicKey(escrowId);
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as any;

        const tokenMint = escrow.tokenMint;
        const vault = this.vaultPda(escrowPubkey);
        const vaultAuthority = this.vaultAuthorityPda(escrowPubkey);
        const buyerToken = getAssociatedTokenAddressSync(tokenMint, escrow.buyer || this.keypair.publicKey);

        const tx = await this.program.methods
            .refundEscrow()
            .accounts({
                protocolWallet: this.keypair.publicKey,
                config: this.configPda(),
                escrowState: escrowPubkey,
                tokenMint,
                vault,
                vaultAuthority,
                buyerToken,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID
            })
            .rpc();

        return tx;
    }
}

let walletManagerInstance: WalletManager | null = null;

export function getWalletManager(): WalletManager {
    if (!walletManagerInstance) {
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        const programId = process.env.SOLANA_PROGRAM_ID || 'DmPtoRqbLZwjwWeecH2uYnrr4xmyvHoabSkoSHS9Q6GG';
        const usdcMint = process.env.SOLANA_USDC_MINT || '';
        const idrxMint = process.env.SOLANA_IDRX_MINT || '';
        walletManagerInstance = new WalletManager(rpcUrl, programId, usdcMint, idrxMint);
    }
    return walletManagerInstance;
}
