import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import * as fs from 'fs';
import path from 'path';

// Minimal IDL for internal use in the server
const IDL: any = {
    version: '0.1.0',
    name: 'vouch_escrow',
    instructions: [
        {
            name: 'initializeConfig',
            accounts: [
                { name: 'config', writable: true, isSigner: false },
                { name: 'payer', writable: true, isSigner: true },
                { name: 'systemProgram', writable: false, isSigner: false }
            ],
            args: [
                { name: 'protocolWallet', type: 'pubkey' },
                { name: 'feeBps', type: 'u16' }
            ]
        },
        {
            name: 'markFunded',
            accounts: [
                { name: 'protocolWallet', writable: true, isSigner: true },
                { name: 'config', writable: false, isSigner: false },
                { name: 'escrowState', writable: true, isSigner: false },
                { name: 'protocolToken', writable: true, isSigner: false },
                { name: 'tokenMint', writable: false, isSigner: false },
                { name: 'vault', writable: true, isSigner: false },
                { name: 'tokenProgram', writable: false, isSigner: false }
            ],
            args: [{ name: 'buyer', type: 'pubkey' }]
        },
        {
            name: 'markShipped',
            accounts: [
                { name: 'caller', writable: true, isSigner: true },
                { name: 'config', writable: false, isSigner: false },
                { name: 'escrowState', writable: true, isSigner: false }
            ],
            args: []
        },
        {
            name: 'confirmDelivery',
            accounts: [
                { name: 'buyer', writable: true, isSigner: true },
                { name: 'config', writable: false, isSigner: false },
                { name: 'escrowState', writable: true, isSigner: false },
                { name: 'buyerToken', writable: true, isSigner: false },
                { name: 'tokenMint', writable: false, isSigner: false },
                { name: 'vault', writable: true, isSigner: false },
                { name: 'vaultAuthority', writable: false, isSigner: false },
                { name: 'sellerToken', writable: true, isSigner: false },
                { name: 'protocolToken', writable: true, isSigner: false },
                { name: 'sellerProfile', writable: true, isSigner: false },
                { name: 'tokenProgram', writable: false, isSigner: false }
            ],
            args: []
        },
        {
            name: 'releaseFunds',
            accounts: [
                { name: 'protocolWallet', writable: true, isSigner: true },
                { name: 'config', writable: false, isSigner: false },
                { name: 'escrowState', writable: true, isSigner: false },
                { name: 'tokenMint', writable: false, isSigner: false },
                { name: 'vault', writable: true, isSigner: false },
                { name: 'vaultAuthority', writable: false, isSigner: false },
                { name: 'sellerToken', writable: true, isSigner: false },
                { name: 'protocolToken', writable: true, isSigner: false },
                { name: 'sellerProfile', writable: true, isSigner: false },
                { name: 'tokenProgram', writable: false, isSigner: false }
            ],
            args: []
        },
        {
            name: 'addRating',
            accounts: [
                { name: 'buyer', writable: true, isSigner: true },
                { name: 'escrowState', writable: true, isSigner: false },
                { name: 'sellerProfile', writable: true, isSigner: false }
            ],
            args: [{ name: 'rating', type: 'u8' }]
        },
        {
            name: 'updateConfig',
            accounts: [
                { name: 'config', writable: true, isSigner: false },
                { name: 'protocolWallet', writable: false, isSigner: true }
            ],
            args: [
                { name: 'protocolWallet', type: { option: 'pubkey' } },
                { name: 'feeBps', type: { option: 'u16' } }
            ]
        },
        {
            name: 'closeEscrow',
            accounts: [
                { name: 'protocolWallet', writable: true, isSigner: true },
                { name: 'config', writable: false, isSigner: false },
                { name: 'escrowState', writable: true, isSigner: false },
                { name: 'vault', writable: true, isSigner: false },
                { name: 'vaultAuthority', writable: false, isSigner: false },
                { name: 'sellerToken', writable: true, isSigner: false },
                { name: 'protocolToken', writable: true, isSigner: false },
                { name: 'tokenProgram', writable: false, isSigner: false }
            ],
            args: []
        }
    ],
    accounts: [
        {
            name: 'config',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'protocolWallet', type: 'pubkey' },
                    { name: 'feeBps', type: 'u16' },
                    { name: 'bump', type: 'u8' }
                ]
            }
        },
        {
            name: 'escrowState',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'seller', type: 'pubkey' },
                    { name: 'buyer', type: { option: 'pubkey' } },
                    { name: 'tokenMint', type: 'pubkey' },
                    { name: 'amount', type: 'u64' },
                    { name: 'releaseTime', type: 'i64' },
                    { name: 'status', type: { defined: 'EscrowStatus' } },
                    { name: 'vaultBump', type: 'u8' },
                    { name: 'descriptionHash', type: { array: ['u8', 32] } }
                ]
            }
        },
        {
            name: 'sellerProfile',
            type: {
                kind: 'struct',
                fields: [
                    { name: 'seller', type: 'pubkey' },
                    { name: 'totalTransactions', type: 'u64' },
                    { name: 'ratingSum', type: 'u64' },
                    { name: 'ratingCount', type: 'u64' },
                    { name: 'disputesWon', type: 'u64' },
                    { name: 'verified', type: 'bool' },
                    { name: 'bump', type: 'u8' }
                ]
            }
        }
    ],
    types: [
        {
            name: 'EscrowStatus',
            type: {
                kind: 'enum',
                variants: [
                    { name: 'WaitingPayment' },
                    { name: 'Funded' },
                    { name: 'Shipped' },
                    { name: 'Released' },
                    { name: 'Disputed' },
                    { name: 'Refunded' }
                ]
            }
        }
    ]
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
        const escrow = await this.program.account.escrowState.fetch(new PublicKey(escrowId)) as EscrowAccount;
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
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as EscrowAccount;

        const tokenMint = escrow.tokenMint;
        const protocolToken = getAssociatedTokenAddressSync(tokenMint, this.keypair.publicKey);
        const vault = this.vaultPda(escrowPubkey);

        const tx = await this.program.methods
            .markFunded(buyer ? new PublicKey(buyer) : PublicKey.default)
            .accounts({
                protocolWallet: this.keypair.publicKey,
                config: this.configPda(),
                escrowState: escrowPubkey,
                protocolToken,
                tokenMint,
                vault,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID
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
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as EscrowAccount;

        const tokenMint = escrow.tokenMint;
        const vault = this.vaultPda(escrowPubkey);
        const vaultAuthority = this.vaultAuthorityPda(escrowPubkey);
        const buyerToken = getAssociatedTokenAddressSync(tokenMint, this.keypair.publicKey); // Server acts as buyer if protocol mediated
        const sellerToken = getAssociatedTokenAddressSync(tokenMint, escrow.seller);
        const protocolToken = getAssociatedTokenAddressSync(tokenMint, this.keypair.publicKey);
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
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID
            })
            .rpc();

        return tx;
    }

    async releaseFunds(escrowId: string): Promise<string> {
        await this.ensureConfig();
        const escrowPubkey = new PublicKey(escrowId);
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as EscrowAccount;

        const tokenMint = escrow.tokenMint;
        const vault = this.vaultPda(escrowPubkey);
        const vaultAuthority = this.vaultAuthorityPda(escrowPubkey);
        const sellerToken = getAssociatedTokenAddressSync(tokenMint, escrow.seller);
        const protocolToken = getAssociatedTokenAddressSync(tokenMint, this.keypair.publicKey);
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
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID
            })
            .rpc();

        return tx;
    }

    async closeEscrow(escrowId: string): Promise<string> {
        await this.ensureConfig();
        const escrowPubkey = new PublicKey(escrowId);
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as EscrowAccount;

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
        const escrow = await this.program.account.escrowState.fetch(escrowPubkey) as EscrowAccount;

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
        const rpcUrl = process.env.SOLANA_RPC_URL || 'http://localhost:8899';
        const programId = process.env.SOLANA_PROGRAM_ID || '11111111111111111111111111111111';
        const usdcMint = process.env.SOLANA_USDC_MINT || 'EPjFWaLb3jqZzpEiwKN7jqvFo8wjRgdq6P1vGHdkDVTe';
        const idrxMint = process.env.SOLANA_IDRX_MINT || 'EPjFWaLb3jqZzpEiwKN7jqvFo8wjRgdq6P1vGHdkDVTe';
        walletManagerInstance = new WalletManager(rpcUrl, programId, usdcMint, idrxMint);
    }
    return walletManagerInstance;
}

let walletManagerInstance: WalletManager | null = null;

export function getWalletManager(): WalletManager {
    if (!walletManagerInstance) {
        const rpcUrl = process.env.SOLANA_RPC_URL || 'http://localhost:8899';
        const programId = process.env.SOLANA_PROGRAM_ID || '11111111111111111111111111111111';
        const usdcMint = process.env.SOLANA_USDC_MINT || 'EPjFWaLb3jqZzpEiwKN7jqvFo8wjRgdq6P1vGHdkDVTe';
        const idrxMint = process.env.SOLANA_IDRX_MINT || 'EPjFWaLb3jqZzpEiwKN7jqvFo8wjRgdq6P1vGHdkDVTe';
        walletManagerInstance = new WalletManager(rpcUrl, programId, usdcMint, idrxMint);
    }
    return walletManagerInstance;
}
