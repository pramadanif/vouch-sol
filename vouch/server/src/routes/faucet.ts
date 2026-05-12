import { Router } from 'express';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, mintTo } from '@solana/spl-token';
import { getWalletManager } from '../lib/wallet';

const router = Router();

// Rate limiting
const lastRequest: Record<string, number> = {};
const COOLDOWN_MS = 60000; // 1 min cooldown per address-token

router.post('/', async (req, res) => {
    try {
        const { address, type } = req.body;

        if (!address || !PublicKey.isOnCurve(address)) {
            return res.status(400).json({ error: 'Invalid Solana address' });
        }

        if (!['sol', 'usdc', 'idrx'].includes(type)) {
            return res.status(400).json({ error: 'Invalid token type. Use: sol, usdc, or idrx' });
        }

        // Rate limit
        const key = `${address}-${type}`;
        const now = Date.now();
        if (lastRequest[key] && now - lastRequest[key] < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - lastRequest[key])) / 1000);
            return res.status(429).json({ error: `Wait ${remaining}s before next request` });
        }

        const rpcUrl = process.env.SOLANA_RPC_URL || 'http://localhost:8899';
        const connection = new Connection(rpcUrl, 'confirmed');
        const userPubkey = new PublicKey(address);

        const wallet = getWalletManager();
        let txHash: string;
        let amount: string;

        if (type === 'sol') {
            // Transfer SOL from Backend Wallet instead of using Devnet Airdrop to avoid 429 Rate Limits
            amount = '0.1';
            const { SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
            const tx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: wallet.signer.publicKey,
                    toPubkey: userPubkey,
                    lamports: 0.1 * LAMPORTS_PER_SOL,
                })
            );
            const sig = await sendAndConfirmTransaction(connection, tx, [wallet.signer]);
            txHash = sig;
        } else {
            // Mint SPL tokens (USDC or IDRX)
            const tokenMint = new PublicKey(
                type === 'usdc' 
                    ? (process.env.SOLANA_USDC_MINT || 'EPjFWaLb3jqZzpEiwKN7jqvFo8wjRgdq6P1vGHdkDVTe')
                    : (process.env.SOLANA_IDRX_MINT || 'EPjFWaLb3jqZzpEiwKN7jqvFo8wjRgdq6P1vGHdkDVTe')
            );

            let userTokenAccount;
            const { getOrCreateAssociatedTokenAccount, transfer } = require('@solana/spl-token');
            try {
                const acct = await getOrCreateAssociatedTokenAccount(
                    connection,
                    wallet.signer, // payer
                    tokenMint,
                    userPubkey
                );
                userTokenAccount = acct.address;
            } catch (err: any) {
                return res.status(500).json({ error: 'Failed to create associated token account for user. ' + err.message });
            }

            amount = type === 'usdc' ? '1000' : '100000';
            const decimals = 6;
            const lamports = BigInt(amount) * BigInt(10 ** decimals);

            try {
                // Try to mint tokens directly (assuming backend wallet is mint authority)
                const sig = await mintTo(
                    connection,
                    wallet.signer, // payer (Keypair)
                    tokenMint,
                    userTokenAccount,
                    wallet.signer, // mintAuthority (Keypair)
                    lamports
                );
                txHash = sig;
            } catch (mintError: any) {
                // If backend is not mint authority, try transferring from backend's own balance
                const { transfer } = require('@solana/spl-token');
                const backendTokenAccount = getAssociatedTokenAddressSync(tokenMint, wallet.signer.publicKey);
                
                try {
                    const sig = await transfer(
                        connection,
                        wallet.signer,
                        backendTokenAccount,
                        userTokenAccount,
                        wallet.signer,
                        lamports
                    );
                    txHash = sig;
                } catch (transferError: any) {
                    throw new Error(`Failed to mint (${mintError.message}) AND failed to transfer (${transferError.message}). Pastikan backend wallet memiliki token atau adalah mint authority.`);
                }
            }
        }

        lastRequest[key] = now;

        console.log(`Faucet: Sent ${amount} ${type.toUpperCase()} to ${address}, tx: ${txHash}`);

        res.json({
            success: true,
            type,
            amount,
            txHash,
            message: `Sent ${amount} ${type.toUpperCase()}`
        });

    } catch (error: any) {
        console.error('Faucet error:', error);
        res.status(500).json({ error: error.message || 'Faucet request failed' });
    }
});

export default router;
