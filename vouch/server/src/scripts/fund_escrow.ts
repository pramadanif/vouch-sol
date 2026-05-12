import { getWalletManager } from '../lib/wallet';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env explicitly to ensure we get the latest
config({ path: resolve(__dirname, '../../.env') });

async function main() {
    const escrowId = "2"; // Target the problematic ID (needs to be a real pubkey for actual use)
    const wallet = getWalletManager();
    console.log(`Using Wallet: ${wallet.address}`);
    console.log(`Using Escrow Contract: ${process.env.ESCROW_CONTRACT_ADDRESS || process.env.VOUCH_ESCROW_ADDRESS}`);

    console.log(`Checking Escrow ID: ${escrowId}...`);
    try {
        const details = await wallet.getEscrowDetails(escrowId);
        console.log('Escrow Details:', {
            tokenMint: details.tokenMint,
            amount: details.amount,
            status: details.status
        });

        if (details.status === 'Funded' || details.status === 'Shipped' || details.status === 'Released') {
            console.log('Escrow already funded on-chain.');
            return;
        }

        console.log('Marking funded...');
        const tx = await wallet.markFunded(escrowId);
        console.log(`Marked funded! Tx: ${tx}`);
    } catch (err: any) {
        console.error('Error:', err);
    }
}

main().catch(console.error);
