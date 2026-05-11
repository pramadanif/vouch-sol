'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { BN, web3 } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
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
    getVaultPda
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
            await connect();
            return;
        }

        try {
            const tokenMint = getTokenMint();
            if (!tokenMint) throw new Error('Token mint not configured');

            const program = getProgram({ publicKey, signTransaction } as any, VOUCH_ESCROW_IDL) as any;
            const escrowPubkey = new PublicKey(escrow.escrowId);
            const vault = getVaultPda(escrowPubkey);
            const buyerToken = getAssociatedTokenAddressSync(new PublicKey(tokenMint), publicKey);

            const txHash = await program.methods
                .fundEscrow()
                .accounts({
                    buyer: publicKey,
                    escrowState: escrowPubkey,
                    buyerToken,
                    tokenMint: new PublicKey(tokenMint),
                    vault,
                    tokenProgram: TOKEN_PROGRAM_ID
                })
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

                const sellerToken = getAssociatedTokenAddressSync(new PublicKey(tokenMint), new PublicKey(escrow.sellerAddress));
                const protocolToken = getAssociatedTokenAddressSync(new PublicKey(tokenMint), protocolWallet);
                const buyerTokenAccount = getAssociatedTokenAddressSync(new PublicKey(tokenMint), publicKey);
                const sellerProfile = getSellerProfilePda(new PublicKey(escrow.sellerAddress));

                await program.methods
                    .confirmDelivery()
                    .accounts({
                        buyer: publicKey,
                        config,
                        escrowState: escrowPubkey,
                        buyerToken: buyerTokenAccount,
                        tokenMint: new PublicKey(tokenMint),
                        vault,
                        vaultAuthority,
                        sellerToken,
                        protocolToken,
                        sellerProfile,
                        tokenProgram: TOKEN_PROGRAM_ID
                    })
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
        <div className="min-h-screen bg-brand-surfaceHighlight pt-24 pb-16">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <FadeIn>
                    <div className="bg-white rounded-2xl shadow-2xl p-10">
                        <h1 className="text-2xl font-bold text-brand-primary mb-2">Pay Securely</h1>
                        <p className="text-brand-secondary mb-6">Escrow powered by Solana.</p>

                        {escrow && (
                            <div className="mb-8">
                                <SellerReputation sellerAddress={escrow.sellerAddress} />
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm mb-6">
                                {error}
                            </div>
                        )}

                        {status === 'pending' && (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Button variant={paymentMethod === 'fiat' ? 'primary' : 'outline'} size="sm" onClick={() => setPaymentMethod('fiat')}>
                                        Pay with QRIS
                                    </Button>
                                    <Button variant={paymentMethod === 'crypto' ? 'primary' : 'outline'} size="sm" onClick={() => setPaymentMethod('crypto')}>
                                        Pay with Crypto
                                    </Button>
                                </div>

                                {paymentMethod === 'fiat' ? (
                                    <>
                                        <Button variant="primary" size="lg" onClick={handlePayFiat} className="w-full">
                                            Pay Now
                                        </Button>
                                        <Button variant="outline" size="lg" onClick={handleSimulatePayment} disabled={isSimulating} className="w-full">
                                            {isSimulating ? 'Simulating...' : 'Simulate Payment'}
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="primary" size="lg" onClick={handlePayCrypto} className="w-full">
                                        Pay with Solana
                                    </Button>
                                )}
                            </div>
                        )}

                        {status === 'secured' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-green-700">
                                    <Check size={18} /> Payment secured.
                                </div>
                                <p className="text-sm text-brand-secondary">Wait for seller to ship item. You can confirm receipt after shipping.</p>
                            </div>
                        )}

                        {status === 'shipped' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-blue-700">
                                    <AlertCircle size={18} /> Item shipped. Confirm receipt to release funds.
                                </div>
                                <Button variant="primary" size="lg" onClick={handleConfirmReceipt} disabled={isConfirming} className="w-full">
                                    {isConfirming ? 'Confirming...' : 'Confirm Receipt'}
                                </Button>
                            </div>
                        )}

                        {status === 'completed' && (
                            <div className="flex items-center gap-2 text-green-700">
                                <Check size={18} /> Payment completed.
                            </div>
                        )}
                    </div>
                </FadeIn>
            </div>
        </div>
    );
}
