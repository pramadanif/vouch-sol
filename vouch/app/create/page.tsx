'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Loader2, Check, AlertCircle, Package, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BN, web3 } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import Button from '@/components/Button';
import FadeIn from '@/components/ui/FadeIn';
import { api } from '@/lib/api';
import { SOLANA_IDRX_MINT, SOLANA_USDC_MINT } from '@/lib/contracts';
import { VOUCH_ESCROW_IDL } from '@/lib/idl/vouch_escrow';
import {
    getProgram,
    getSellerProfilePda,
    getVaultAuthorityPda,
    getVaultPda,
    hashDescription
} from '@/lib/solana';

function ShareStep({
    generatedLink,
    escrowId,
    copied,
    handleCopy,
    onCreateAnother
}: {
    generatedLink: string;
    escrowId: string | null;
    copied: boolean;
    handleCopy: () => void;
    onCreateAnother: () => void;
}) {
    const [status, setStatus] = useState<string>('CREATED');
    const [isPolling, setIsPolling] = useState(true);

    useEffect(() => {
        if (!escrowId || !isPolling) return;

        const pollStatus = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/escrow/${escrowId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data.status);
                    if (['FUNDED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'REFUNDED'].includes(data.status)) {
                        setIsPolling(false);
                    }
                }
            } catch (err) {
                console.error('Failed to poll escrow status:', err);
            }
        };

        pollStatus();
        const interval = setInterval(pollStatus, 5000);
        return () => clearInterval(interval);
    }, [escrowId, isPolling]);

    const isFunded = status === 'FUNDED';

    return (
        <FadeIn className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-10 text-center">
                {isFunded ? (
                    <>
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-200 animate-pulse">
                            <Package size={32} className="text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-700 mb-3">Payment Received!</h2>
                        <p className="text-brand-secondary mb-6">
                            Buyer paid. Ship item and upload shipment proof on dashboard.
                        </p>

                        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
                            <div className="flex items-center justify-center gap-3 text-green-700">
                                <AlertCircle size={20} />
                                <span className="font-semibold">Action Required</span>
                            </div>
                            <p className="text-sm text-green-600 mt-2">
                                Go to dashboard to upload shipment proof
                            </p>
                        </div>

                        <Link href="/dashboard">
                            <Button variant="primary" size="lg" className="w-full">
                                <span className="flex items-center justify-center gap-2">
                                    Go to Dashboard <ArrowRight size={18} />
                                </span>
                            </Button>
                        </Link>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100">
                            <Check size={32} className="text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-brand-primary mb-3">Link Created!</h2>
                        <p className="text-brand-secondary mb-4">Share this link with your buyer to receive payment.</p>

                        <div className="flex items-center justify-center gap-2 text-sm text-brand-secondary mb-6">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                            Waiting for buyer payment...
                        </div>

                        <div className="bg-brand-surfaceHighlight p-4 rounded-xl flex items-center gap-3 mb-6 border border-brand-border/50">
                            <code className="flex-1 text-sm text-brand-action font-medium truncate bg-white px-3 py-2 rounded-lg">{generatedLink}</code>
                            <button
                                onClick={handleCopy}
                                className={`p-3 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-white text-brand-secondary hover:text-brand-primary border border-brand-border/50'}`}
                            >
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="outline" size="lg" onClick={onCreateAnother}>
                                Create Another
                            </Button>
                            <Link href="/dashboard">
                                <Button variant="primary" size="lg" className="w-full">Dashboard</Button>
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </FadeIn>
    );
}

export default function CreateLinkPage() {
    const [step, setStep] = useState<'connect' | 'create' | 'share'>('connect');
    const [generatedLink, setGeneratedLink] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [isMounted, setIsMounted] = useState(false);

    const [itemName, setItemName] = useState('');
    const [itemDescription, setItemDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [fiatCurrency, setFiatCurrency] = useState<'IDR' | 'SGD' | 'MYR' | 'THB' | 'PHP' | 'VND'>('IDR');
    const [releaseDuration, setReleaseDuration] = useState(86400);

    const [escrowId, setEscrowId] = useState<string | null>(null);

    const { publicKey, connected, connect, disconnect, signTransaction } = useWallet();

    const currencyConfig: Record<string, { symbol: string; name: string; usdcRate: number; flag: string }> = {
        IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', usdcRate: 16800, flag: '🇮🇩' },
        SGD: { symbol: 'S$', name: 'Singapore Dollar', usdcRate: 1.29, flag: '🇸🇬' },
        MYR: { symbol: 'RM', name: 'Malaysian Ringgit', usdcRate: 4.07, flag: '🇲🇾' },
        THB: { symbol: '฿', name: 'Thai Baht', usdcRate: 31.4, flag: '🇹🇭' },
        PHP: { symbol: '₱', name: 'Philippine Peso', usdcRate: 59.2, flag: '🇵🇭' },
        VND: { symbol: '₫', name: 'Vietnamese Dong', usdcRate: 26200, flag: '🇻🇳' }
    };

    useEffect(() => {
        setIsMounted(true);
        if (connected && publicKey) setStep('create');
        else setStep('connect');
    }, [connected, publicKey]);

    const handleConnect = async () => {
        await connect();
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

            const cryptoCurrency = fiatCurrency === 'IDR' ? 'IDRX' : 'USDC';
            const tokenMint = cryptoCurrency === 'IDRX' ? SOLANA_IDRX_MINT : SOLANA_USDC_MINT;
            const tokenDecimals = cryptoCurrency === 'IDRX' ? 9 : 6;

            if (!tokenMint) throw new Error('Token mint not configured');

            const rawAmount = amount.replace(/[^0-9.]/g, '');
            const amountFiat = rawAmount;

            let tokenAmount: string;
            if (cryptoCurrency === 'IDRX') {
                tokenAmount = rawAmount;
            } else {
                const usdcAmount = parseFloat(rawAmount) / currencyConfig[fiatCurrency].usdcRate;
                tokenAmount = usdcAmount.toFixed(2);
            }

            const releaseTime = Math.floor(Date.now() / 1000) + releaseDuration;
            const program = getProgram({ publicKey, signTransaction } as any, VOUCH_ESCROW_IDL);

            const sellerProfile = getSellerProfilePda(publicKey);
            try {
                await program.account.sellerProfile.fetch(sellerProfile);
            } catch {
                await program.methods
                    .initSellerProfile()
                    .accounts({
                        seller: publicKey,
                        sellerProfile,
                        systemProgram: web3.SystemProgram.programId
                    })
                    .rpc();
            }

            const escrowKeypair = Keypair.generate();
            const escrowPubkey = escrowKeypair.publicKey;
            const vault = getVaultPda(escrowPubkey);
            const vaultAuthority = getVaultAuthorityPda(escrowPubkey);

            const amountBase = new BN(Math.floor(parseFloat(tokenAmount) * Math.pow(10, tokenDecimals)));
            const descriptionHash = hashDescription(`${itemName}|${itemDescription}|${amountFiat}`);

            const txHash = await program.methods
                .createEscrow(amountBase, new BN(releaseTime), Array.from(descriptionHash))
                .accounts({
                    seller: publicKey,
                    escrowState: escrowPubkey,
                    tokenMint: new PublicKey(tokenMint),
                    vault,
                    vaultAuthority,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: web3.SystemProgram.programId,
                    rent: web3.SYSVAR_RENT_PUBKEY
                })
                .signers([escrowKeypair])
                .rpc();

            const response = await api.createEscrow({
                sellerAddress: publicKey.toBase58(),
                itemName,
                itemDescription,
                amountIdr: amountFiat,
                fiatCurrency,
                releaseDuration,
                currency: cryptoCurrency,
                txHash,
                onChainEscrowId: escrowPubkey.toBase58()
            });

            setGeneratedLink(response.paymentLink);
            setEscrowId(response.escrowId);
            setStep('share');
        } catch (err: any) {
            console.error('Create escrow error:', err);
            setError(err.message || 'Failed to create escrow');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleCreateAnother = () => {
        setStep('create');
        setGeneratedLink('');
        setEscrowId(null);
        setItemName('');
        setItemDescription('');
        setAmount('');
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-brand-surfaceHighlight pt-24 pb-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <FadeIn>
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold text-brand-primary">Create Payment Link</h1>
                        <p className="text-brand-secondary mt-3">Solana escrow for social commerce.</p>
                    </div>
                </FadeIn>

                {step === 'connect' && (
                    <FadeIn className="max-w-lg mx-auto">
                        <div className="bg-white rounded-2xl shadow-2xl p-10 text-center">
                            <h2 className="text-2xl font-bold text-brand-primary mb-4">Connect Wallet</h2>
                            <p className="text-brand-secondary mb-8">Connect your Solana wallet to create escrow links.</p>
                            <Button onClick={handleConnect} size="lg" variant="primary" className="w-full">
                                Connect Wallet
                            </Button>
                        </div>
                    </FadeIn>
                )}

                {step === 'create' && (
                    <FadeIn className="max-w-2xl mx-auto">
                        <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-2xl p-10">
                            <div className="grid gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-brand-primary mb-2">Item Name</label>
                                    <input
                                        type="text"
                                        value={itemName}
                                        onChange={(e) => setItemName(e.target.value)}
                                        className="w-full border border-brand-border rounded-xl px-4 py-3"
                                        placeholder="Nike Air Jordan 1"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-brand-primary mb-2">Description</label>
                                    <textarea
                                        value={itemDescription}
                                        onChange={(e) => setItemDescription(e.target.value)}
                                        className="w-full border border-brand-border rounded-xl px-4 py-3"
                                        rows={3}
                                        placeholder="Condition, size, details"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-brand-primary mb-2">Amount</label>
                                        <input
                                            type="text"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full border border-brand-border rounded-xl px-4 py-3"
                                            placeholder="250000"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-brand-primary mb-2">Currency</label>
                                        <select
                                            value={fiatCurrency}
                                            onChange={(e) => setFiatCurrency(e.target.value as any)}
                                            className="w-full border border-brand-border rounded-xl px-4 py-3"
                                        >
                                            {Object.entries(currencyConfig).map(([code, cfg]) => (
                                                <option key={code} value={code}>{cfg.flag} {code}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-brand-primary mb-2">Auto-release</label>
                                    <select
                                        value={releaseDuration}
                                        onChange={(e) => setReleaseDuration(parseInt(e.target.value))}
                                        className="w-full border border-brand-border rounded-xl px-4 py-3"
                                    >
                                        <option value={86400}>24 hours</option>
                                        <option value={259200}>3 days</option>
                                        <option value={604800}>7 days</option>
                                        <option value={1209600}>14 days</option>
                                    </select>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                                        {error}
                                    </div>
                                )}

                                <Button variant="primary" size="lg" className="w-full" disabled={isLoading}>
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="animate-spin" size={18} /> Creating Escrow...
                                        </span>
                                    ) : (
                                        'Create Link'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </FadeIn>
                )}

                {step === 'share' && (
                    <ShareStep
                        generatedLink={generatedLink}
                        escrowId={escrowId}
                        copied={copied}
                        handleCopy={handleCopy}
                        onCreateAnother={handleCreateAnother}
                    />
                )}
            </div>
        </div>
    );
}
