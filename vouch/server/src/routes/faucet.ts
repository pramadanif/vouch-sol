import { Router } from 'express';
import { Connection, PublicKey, LAMPORTS_PER_SOL, requestAirdrop } from '@solana/web3.js';
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

        let txHash: string;
        let amount: string;

        if (type === 'sol') {
            // Airdrop SOL
            amount = '1';
            const sig = await requestAirdrop(connection, userPubkey, 1 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig, 'confirmed');
            txHash = sig;
        } else {
            // Mint SPL tokens (USDC or IDRX)
            const wallet = getWalletManager();
            const tokenMint = new PublicKey(
                type === 'usdc' 
                    ? (process.env.SOLANA_USDC_MINT || 'EPjFWaLb3jqZzpEiwKN7jqvFo8wjRgdq6P1vGHdkDVTe')
                    : (process.env.SOLANA_IDRX_MINT || 'EPjFWaLb3jqZzpEiwKN7jqvFo8wjRgdq6P1vGHdkDVTe')
            );

            const userTokenAccount = getAssociatedTokenAddressSync(tokenMint, userPubkey);
            const faucetAccount = getAssociatedTokenAddressSync(tokenMint, new PublicKey(wallet.address));

            // Check if user token account exists; if not, create it
            const acctInfo = await connection.getAccountInfo(userTokenAccount);
            if (!acctInfo) {
                return res.status(400).json({ error: 'User token account does not exist. Create via wallet first.' });
            }

            amount = type === 'usdc' ? '1000' : '100000';
            const decimals = type === 'usdc' ? 6 : 18;
            const lamports = BigInt(amount) * BigInt(10 ** decimals);

            const sig = await mintTo(
                connection,
                new PublicKey(wallet.address) as any, // payer (should be keypair but type forces this)
                tokenMint,
                userTokenAccount,
                new PublicKey(wallet.address),
                lamports
            );
            txHash = sig;
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
