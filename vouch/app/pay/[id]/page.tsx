'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Check, Loader2, AlertCircle, Package } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { BN, web3 } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import Button from '@/components/Button';
import FadeIn from '@/components/ui/FadeIn';
import SellerReputation from '@/components/SellerReputation';
import { api, EscrowDetails } from '@/lib/api';
import { SOLANA_IDRX_MINT, SOLANA_USDC_MINT } from '@/lib/contracts';
import { VOUCH_ESCROW_IDL } from '@/lib/idl/vouch_escrow';
import {
    getConfigPda,
    getProgram,
    getSellerProfilePda,
    getVaultAuthorityPda,
    getVaultPda,
    connection
} from '@/lib/solana';

const BUYER_TOKEN_KEY = 'vouch_buyer_token_';
const getBuyerToken = (escrowId: string): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(BUYER_TOKEN_KEY + escrowId);
};
const setBuyerToken = (escrowId: string, token: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BUYER_TOKEN_KEY + escrowId, token);
};

export default function PayLinkPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const escrowId = params.id as string;

    const [escrow, setEscrow] = useState<EscrowDetails | null>(null);
    const [status, setStatus] = useState<'loading' | 'pending' | 'paying' | 'verifying' | 'secured' | 'shipped' | 'completed' | 'error'>('loading');
    const [error, setError] = useState('');
    const [isSimulating, setIsSimulating] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'fiat' | 'crypto'>('fiat');
    const [buyerToken, setBuyerTokenState] = useState<string | null>(null);

    const { publicKey, connected, connect, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();

    const fetchEscrow = useCallback(async () => {
        try {
            const data = await api.getEscrow(escrowId);
            setEscrow(data);
            if (data.status === 'RELEASED') setStatus('completed');
            else if (data.status === 'SHIPPED') setStatus('shipped');
            else if (data.status === 'FUNDED') setStatus('secured');
            else setStatus('pending');
        } catch (err: any) {
            setError(err.message || 'Failed to load');
            setStatus('error');
        }
    }, [escrowId]);

    useEffect(() => {
        fetchEscrow();
        const storedToken = getBuyerToken(escrowId);
        if (storedToken) setBuyerTokenState(storedToken);
    }, [fetchEscrow, escrowId]);

    useEffect(() => {
        if (escrow && escrow.fiatCurrency !== 'IDR') {
            setPaymentMethod('crypto');
        }
    }, [escrow]);

    useEffect(() => {
        if (searchParams.get('status') === 'success') {
            setStatus('verifying');
            api.checkPaymentStatus(escrowId).then((res) => {
                if (res.success && res.buyerToken) {
                    setBuyerToken(escrowId, res.buyerToken);
                    setBuyerTokenState(res.buyerToken);
                }
            });
        }
    }, [searchParams, escrowId]);

    const getTokenMint = () => {
        if (!escrow) return '';
        return escrow.currency === 'IDRX' ? SOLANA_IDRX_MINT : SOLANA_USDC_MINT;
    };

    const handlePayFiat = async () => {
        setStatus('paying');
        try {
            const result = await api.createInvoice(escrowId);
            window.location.href = result.invoiceUrl;
        } catch (err: any) {
            setError(err.message);
            setStatus('pending');
        }
    };

    const handleSimulatePayment = async () => {
        setIsSimulating(true);
        try {
            const result = await api.simulatePayment(escrowId);
            if (result.buyerToken) {
                setBuyerToken(escrowId, result.buyerToken);
                setBuyerTokenState(result.buyerToken);
            }
            await fetchEscrow();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSimulating(false);
        }
    };

    const handlePayCrypto = async () => {
        setError('');
        if (!escrow?.escrowId) return;
        if (!publicKey || !signTransaction) {
            try {
                await connect();
            } catch (e) {
                setVisible(true);
            }
            return;
        }

        try {
            const tokenMint = getTokenMint();
            if (!tokenMint) throw new Error('Token mint not configured');

            const program = getProgram({ publicKey, signTransaction } as any, VOUCH_ESCROW_IDL) as any;
            const escrowPubkey = new PublicKey(escrow.escrowId);
            const vault = getVaultPda(escrowPubkey);
            const tokenMintPubkey = new PublicKey(tokenMint);
            const buyerToken = getAssociatedTokenAddressSync(tokenMintPubkey, publicKey);

            // Auto-create the buyer's ATA in the same transaction if it doesn't exist
            // Using idempotent instruction: safe to include even if ATA already exists
            const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                publicKey,        // payer
                buyerToken,       // ata address
                publicKey,        // owner
                tokenMintPubkey,  // mint
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            );

            const txHash = await program.methods
                .fundEscrow()
                .accounts({
                    buyer: publicKey,
                    escrowState: escrowPubkey,
                    buyerToken,
                    tokenMint: tokenMintPubkey,
                    vault,
                    tokenProgram: TOKEN_PROGRAM_ID
                })
                .preInstructions([createAtaIx])
                .rpc();

            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/escrow/${escrowId}/crypto-funded`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ txHash, buyerAddress: publicKey.toBase58() })
            });

            await fetchEscrow();
        } catch (err: any) {
            setError(err.message || 'Crypto payment failed');
        }
    };

    const handleConfirmReceipt = async () => {
        if (!escrow?.escrowId) return;

        const isCryptoBuyer = connected && publicKey && escrow.buyerAddress && publicKey.toBase58().toLowerCase() === escrow.buyerAddress.toLowerCase();
        if (!buyerToken && !isCryptoBuyer) {
            setError('Only buyer who paid can confirm receipt.');
            return;
        }

        setIsConfirming(true);
        setError('');

        try {
            if (isCryptoBuyer) {
                const tokenMint = getTokenMint();
                if (!tokenMint) throw new Error('Token mint not configured');

                const program = getProgram({ publicKey, signTransaction } as any, VOUCH_ESCROW_IDL as any) as any;
                const escrowPubkey = new PublicKey(escrow.escrowId);
                const vault = getVaultPda(escrowPubkey);
                const vaultAuthority = getVaultAuthorityPda(escrowPubkey);
                const config = getConfigPda();

                const configAccount: any = await (program as any).account.config.fetch(config);
                const protocolWallet = new PublicKey(configAccount.protocolWallet);

                const sellerAddressPubkey = new PublicKey(escrow.sellerAddress);
                const tokenMintPubkey = new PublicKey(tokenMint);

                const sellerToken = getAssociatedTokenAddressSync(tokenMintPubkey, sellerAddressPubkey);
                const protocolToken = getAssociatedTokenAddressSync(tokenMintPubkey, protocolWallet);
                const buyerTokenAccount = getAssociatedTokenAddressSync(tokenMintPubkey, publicKey);
                const sellerProfile = getSellerProfilePda(sellerAddressPubkey);

                // Auto-create seller and protocol ATAs if they don't exist
                const createSellerAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                    publicKey,           // payer (buyer)
                    sellerToken,         // ata address
                    sellerAddressPubkey, // owner
                    tokenMintPubkey,     // mint
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );

                const createProtocolAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                    publicKey,           // payer (buyer)
                    protocolToken,       // ata address
                    protocolWallet,      // owner
                    tokenMintPubkey,     // mint
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );

                await program.methods
                    .confirmDelivery()
                    .accounts({
                        buyer: publicKey,
                        config,
                        escrowState: escrowPubkey,
                        buyerToken: buyerTokenAccount,
                        tokenMint: tokenMintPubkey,
                        vault,
                        vaultAuthority,
                        sellerToken,
                        protocolToken,
                        sellerProfile,
                        tokenProgram: TOKEN_PROGRAM_ID
                    })
                    .preInstructions([createProtocolAtaIx, createSellerAtaIx])
                    .rpc();

                await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/escrow/${escrowId}/confirm-crypto`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ buyerAddress: publicKey.toBase58() })
                });
            } else if (buyerToken) {
                await api.confirmReceipt(escrowId, buyerToken);
            }

            await fetchEscrow();
            setStatus('completed');
        } catch (err: any) {
            setError(err.message || 'Failed to confirm receipt');
        } finally {
            setIsConfirming(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin" size={28} />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-red-600">{error || 'Failed to load escrow'}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative pt-24 pb-16 bg-brand-surfaceHighlight overflow-hidden">
            {/* Elegant Grid Background */}
            <div className="absolute inset-0 bg-grid z-0 opacity-40"></div>
            
            {/* Abstract Blue Shapes to make it "ramai" */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-brand-ice/60 blur-3xl -translate-y-1/3 translate-x-1/3 mix-blend-multiply animate-pulse-soft"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-brand-action/10 blur-3xl translate-y-1/3 -translate-x-1/4 mix-blend-multiply animate-pulse-soft" style={{animationDelay: '2s'}}></div>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <FadeIn>
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-ice/30 border border-brand-ice mb-4 animate-fade-up">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-action opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-action"></span>
                            </span>
                            <span className="text-[10px] sm:text-xs font-semibold text-brand-primary tracking-wide uppercase">Secure Payment Checkout</span>
                        </div>
                    </div>
                </FadeIn>

                <FadeIn>
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/50 ring-1 ring-black/5">
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold text-brand-primary mb-2">Pay Securely</h1>
                            <p className="text-brand-secondary font-light">Your funds are locked in an on-chain escrow.</p>
                        </div>

                        {escrow && (
                            <div className="mb-10 bg-brand-surfaceHighlight rounded-2xl p-6 border border-brand-border shadow-inner">
                                <div className="flex justify-between items-center mb-4 pb-4 border-b border-brand-border/50">
                                    <div>
                                        <h3 className="font-bold text-brand-primary text-lg">{escrow.itemName}</h3>
                                        <p className="text-sm text-brand-secondary">{escrow.itemDescription || 'No description provided'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-brand-action">{escrow.fiatCurrency} {escrow.amountIdr}</p>
                                        <p className="text-xs text-brand-secondary font-medium uppercase mt-1">{escrow.amountUsdc} {escrow.currency}</p>
                                    </div>
                                </div>
                                <SellerReputation sellerAddress={escrow.sellerAddress} />
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm flex gap-3 items-start mb-8">
                                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {status === 'pending' && (
                            <div className="space-y-6">
                                <div className="flex justify-center gap-3">
                                    <Button 
                                        variant={paymentMethod === 'fiat' ? 'primary' : 'outline'} 
                                        size="md" 
                                        onClick={() => setPaymentMethod('fiat')}
                                        className={paymentMethod === 'fiat' ? 'shadow-md shadow-brand-action/20 w-full sm:w-auto' : 'w-full sm:w-auto bg-white'}
                                    >
                                        Pay with QRIS / Fiat
                                    </Button>
                                    <Button 
                                        variant={paymentMethod === 'crypto' ? 'primary' : 'outline'} 
                                        size="md" 
                                        onClick={() => setPaymentMethod('crypto')}
                                        className={paymentMethod === 'crypto' ? 'shadow-md shadow-brand-action/20 w-full sm:w-auto' : 'w-full sm:w-auto bg-white'}
                                    >
                                        Pay with Crypto
                                    </Button>
                                </div>

                                <div className="pt-4 border-t border-brand-border/50">
                                    {paymentMethod === 'fiat' ? (
                                        <div className="space-y-4">
                                            <Button variant="primary" size="lg" onClick={handlePayFiat} className="w-full shadow-lg shadow-brand-action/20 py-4 text-base">
                                                Continue to Payment
                                            </Button>
                                            <Button variant="outline" size="lg" onClick={handleSimulatePayment} disabled={isSimulating} className="w-full bg-white text-brand-secondary py-4 text-base">
                                                {isSimulating ? (
                                                    <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Simulating...</span>
                                                ) : 'Simulate Payment (Devnet)'}
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button variant="primary" size="lg" onClick={handlePayCrypto} className="w-full shadow-lg shadow-brand-action/20 py-4 text-base">
                                            Pay {escrow?.amountUsdc} {escrow?.currency} from Wallet
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {status === 'secured' && (
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check size={32} className="text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-green-700 mb-2">Payment Secured</h3>
                                <p className="text-brand-secondary font-light">Your funds are safely locked in escrow. Please wait for the seller to ship your item.</p>
                            </div>
                        )}

                        {status === 'shipped' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                    <Package size={32} className="text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-brand-primary mb-2">Item Shipped!</h3>
                                <p className="text-brand-secondary font-light mb-6">The seller has shipped the item. Once you receive it and verify its condition, click confirm below to release the funds.</p>
                                <Button variant="primary" size="lg" onClick={handleConfirmReceipt} disabled={isConfirming} className="w-full shadow-lg shadow-brand-action/20 py-4 text-base">
                                    {isConfirming ? (
                                        <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Confirming on-chain...</span>
                                    ) : 'Confirm Receipt & Release Funds'}
                                </Button>
                            </div>
                        )}

                        {status === 'completed' && (
                            <div className="bg-brand-ice/20 border border-brand-action/20 rounded-2xl p-6 text-center">
                                <div className="w-16 h-16 bg-brand-action rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-action/30">
                                    <Check size={32} className="text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-brand-primary mb-2">Transaction Completed</h3>
                                <p className="text-brand-secondary font-light">Funds have been successfully released to the seller. Thank you for using Vouch!</p>
                            </div>
                        )}
                    </div>
                </FadeIn>
            </div>
        </div>
    );
}
