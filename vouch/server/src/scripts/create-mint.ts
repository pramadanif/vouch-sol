import { Connection, Keypair } from '@solana/web3.js';
import { createMint } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const keyPath = '/Users/muhammadbaguspramadani/Documents/myproject/vouch-sol/vouch/solana-program/id.json';
    const secretKey = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

    console.log('Wallet:', wallet.publicKey.toBase58());

    const mint = await createMint(
        connection,
        wallet,
        wallet.publicKey,
        wallet.publicKey,
        6 // 6 decimals instead of 18
    );

    console.log('New IDRX Mint:', mint.toBase58());
}

main().catch(console.error);
