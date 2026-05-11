export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
export const SOLANA_PROGRAM_ID = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || 'VouchEscrow11111111111111111111111111111111';
export const SOLANA_USDC_MINT = process.env.NEXT_PUBLIC_SOLANA_USDC_MINT || '';
export const SOLANA_IDRX_MINT = process.env.NEXT_PUBLIC_SOLANA_IDRX_MINT || '';

export const PDA_SEEDS = {
    config: 'config',
    sellerProfile: 'seller-profile',
    vault: 'vault',
    vaultAuthority: 'vault-authority'
} as const;
