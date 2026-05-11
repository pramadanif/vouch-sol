import { AnchorProvider, Program, utils } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';

export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
export const SOLANA_PROGRAM_ID = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || 'DmPtoRqbLZwjwWeecH2uYnrr4xmyvHoabSkoSHS9Q6GG';

export const PDA_SEEDS = {
    config: 'config',
    sellerProfile: 'seller-profile',
    vault: 'vault',
    vaultAuthority: 'vault-authority'
} as const;

export const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export function getProgram(wallet: WalletContextState, idl: any) {
    if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
    }

    const provider = new AnchorProvider(connection, wallet as any, {
        commitment: 'confirmed'
    });

    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    return new Program(idl, programId, provider);
}

export function getConfigPda(): PublicKey {
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const [config] = PublicKey.findProgramAddressSync([Buffer.from(PDA_SEEDS.config)], programId);
    return config;
}

export function getSellerProfilePda(seller: PublicKey): PublicKey {
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const [profile] = PublicKey.findProgramAddressSync(
        [Buffer.from(PDA_SEEDS.sellerProfile), seller.toBuffer()],
        programId
    );
    return profile;
}

export function getVaultPda(escrow: PublicKey): PublicKey {
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from(PDA_SEEDS.vault), escrow.toBuffer()],
        programId
    );
    return vault;
}

export function getVaultAuthorityPda(escrow: PublicKey): PublicKey {
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    const [authority] = PublicKey.findProgramAddressSync(
        [Buffer.from(PDA_SEEDS.vaultAuthority), escrow.toBuffer()],
        programId
    );
    return authority;
}

export function hashDescription(text: string): Uint8Array {
    return utils.sha256.hash(text);
}
