import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getEscrowById, markEscrowFunded } from '../lib/db';
import { getWalletManager } from '../lib/wallet';
import { getXenditClient } from '../lib/xendit';

const router = Router();

/**
 * Generate a secure random token for buyer verification
 */
function generateBuyerToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Shared logic to process a successful payment
 */
async function processPaymentSuccess(escrowId: string, invoiceId?: string) {
    const escrow = await getEscrowById(escrowId);
    if (!escrow) throw new Error('Escrow not found');

    // Already processed?
    if (['FUNDED', 'SHIPPED', 'DELIVERED', 'RELEASED'].includes(escrow.status)) {
        return { processed: false, reason: 'already_processed', buyerToken: escrow.buyerToken };
    }

    // Generate buyer token for secure confirmation
    const buyerToken = generateBuyerToken();

    // Mark funded in database with buyer token
    await markEscrowFunded(escrow.id, invoiceId, buyerToken);

    // Try to mark funded on-chain
    if (escrow.escrowId !== null) {
        try {
            const wallet = getWalletManager();
            await wallet.markFunded(escrow.escrowId);

            console.log(`Escrow ${escrow.id} marked funded on-chain`);
        } catch (err: any) {
            console.warn(`On-chain markFunded failed: ${err.message}`);
        }
    }

    console.log(`Escrow ${escrow.id} marked as FUNDED with buyerToken`);
    return { processed: true, buyerToken };
}

/**
 * POST /api/payment/check-status
 * Manually check payment status with Xendit (fallback for webhooks)
 */
router.post('/check-status', async (req: Request, res: Response) => {
    try {
        const { escrowId } = req.body;
        const escrow = await getEscrowById(escrowId);

        if (!escrow) return res.status(404).json({ error: 'Escrow not found' });

        // If already funded, return success
        if (escrow.status === 'FUNDED' || escrow.status === 'RELEASED') {
            return res.json({ success: true, status: escrow.status });
        }

        // If no invoice URL, it hasn't started payment
        if (!escrow.xenditInvoiceUrl) {
            return res.status(400).json({ error: 'No invoice created yet' });
        }

        const xendit = getXenditClient();
        const invoiceId = escrow.xenditInvoiceId || '';

        if (!invoiceId) {
            return res.status(400).json({ error: 'Could not determine invoice ID' });
        }

        console.log(`Checking Xendit status for invoice ${invoiceId} (Escrow: ${escrowId})`);

        try {
            const invoice = await xendit.getInvoice(invoiceId);
            if (invoice.status === 'PAID' || invoice.status === 'SETTLED') {
                const result = await processPaymentSuccess(escrowId, invoiceId);
                return res.json({ success: true, status: 'FUNDED', buyerToken: result.buyerToken });
            }
            return res.json({ success: false, status: invoice.status });
        } catch (err: any) {
            // Handle 404 from Xendit if the URL ID extraction was wrong
            console.error('Xendit check failed:', err.message);
            // Fallback: If simulation mode, maybe we just trust? No.
            return res.json({ success: false, error: 'Check failed' });
        }

    } catch (error: any) {
        console.error('Check status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/payment/xendit/callback
 * Handle Xendit payment webhook
 */
router.post('/xendit/callback', async (req: Request, res: Response) => {
    try {
        const callbackToken = req.headers['x-callback-token'] as string;
        const xendit = getXenditClient();

        // Verify callback (skip in mock mode)
        if (!xendit.isMockMode && !xendit.verifyCallback(req.body, callbackToken)) {
            console.warn('Invalid Xendit callback signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const { external_id, status, id: invoiceId } = req.body;
        console.log(`Xendit callback: invoice=${invoiceId}, status=${status}, escrow=${external_id}`);

        // Only process successful payments
        if (status !== 'PAID' && status !== 'SETTLED') {
            return res.json({ received: true, processed: false });
        }

        const result = await processPaymentSuccess(external_id, invoiceId);
        res.json({ received: true, ...result });

    } catch (error: any) {
        console.error('Xendit callback error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/payment/simulate/:id
 * Simulate payment success (for demo/mock mode only)
 */
router.post('/simulate/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const xendit = getXenditClient();

        if (!xendit.isMockMode) {
            return res.status(400).json({ error: 'Simulation only available in mock mode' });
        }

        const result = await processPaymentSuccess(id);

        res.json({
            success: true,
            message: 'Payment simulated successfully',
            escrowId: id,
            buyerToken: result.buyerToken
        });
    } catch (error: any) {
        console.error('Simulate payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
