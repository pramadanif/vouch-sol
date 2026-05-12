'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Loader2, Check, AlertCircle, Package, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BN, web3 } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
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
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 text-center border border-white/50 ring-1 ring-black/5">
                {isFunded ? (
                    <>
                        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-200">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                                <Package size={32} className="text-green-600" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-green-700 mb-3">Payment Received!</h2>
                        <p className="text-brand-secondary mb-6 font-light">
                            The buyer has paid. Please ship the item and upload the shipment proof on your dashboard.
                        </p>

                        <div className="bg-green-50/80 border border-green-200 rounded-2xl p-5 mb-8">
                            <div className="flex items-center justify-center gap-3 text-green-700 mb-1">
                                <AlertCircle size={20} />
                                <span className="font-semibold text-sm">Action Required</span>
                            </div>
                            <p className="text-sm text-green-600">
                                Go to the dashboard to upload your shipment proof to release the funds.
                            </p>
                        </div>

                        <Link href="/dashboard">
                            <Button variant="primary" size="lg" className="w-full shadow-lg shadow-green-600/20 bg-green-600 hover:bg-green-700">
                                <span className="flex items-center justify-center gap-2 text-white">
                                    Go to Dashboard <ArrowRight size={18} />
                                </span>
                            </Button>
                        </Link>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 bg-brand-surfaceHighlight rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-border">
                            <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center">
                                <Check size={28} className="text-brand-action" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-brand-primary mb-3">Payment Link Ready!</h2>
                        <p className="text-brand-secondary mb-6 font-light">Share this link with your buyer to receive payment securely.</p>

                        <div className="flex items-center justify-center gap-2 text-sm text-brand-secondary mb-8 bg-brand-surfaceHighlight w-max mx-auto px-4 py-2 rounded-full border border-brand-border">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                            <span className="font-medium">Waiting for buyer to pay...</span>
                        </div>

                        <div className="bg-brand-surfaceHighlight p-2 pl-4 rounded-2xl flex items-center gap-3 mb-8 border border-brand-border/50 shadow-inner">
                            <code className="flex-1 text-sm text-brand-action font-semibold truncate text-left">{generatedLink}</code>
                            <button
                                onClick={handleCopy}
                                className={`p-3.5 rounded-xl transition-all shadow-sm ${copied ? 'bg-green-500 text-white' : 'bg-white text-brand-secondary hover:text-brand-primary border border-brand-border/50'}`}
                            >
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="outline" size="lg" onClick={onCreateAnother} className="bg-white">
                                Create Another
                            </Button>
                            <Link href="/dashboard">
                                <Button variant="primary" size="lg" className="w-full shadow-lg shadow-brand-action/20">Dashboard</Button>
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
    const { setVisible } = useWalletModal();

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
        try {
            await connect();
        } catch (error) {
            console.log('Connect error, opening modal:', error);
            setVisible(true);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

            const cryptoCurrency = fiatCurrency === 'IDR' ? 'IDRX' : 'USDC';
            const tokenMint = cryptoCurrency === 'IDRX' ? SOLANA_IDRX_MINT : SOLANA_USDC_MINT;
            const tokenDecimals = cryptoCurrency === 'IDRX' ? 18 : 6;

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
            const program = getProgram({ publicKey, signTransaction } as any, VOUCH_ESCROW_IDL) as any;

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
        <div className="min-h-screen relative pt-24 pb-16 bg-brand-surfaceHighlight overflow-hidden">
            {/* Elegant Grid Background */}
            <div className="absolute inset-0 bg-grid z-0 opacity-40"></div>
            
            {/* Abstract Blue Shapes to make it "ramai" */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-brand-ice/60 blur-3xl -translate-y-1/3 translate-x-1/3 mix-blend-multiply animate-pulse-soft"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-brand-action/10 blur-3xl translate-y-1/3 -translate-x-1/4 mix-blend-multiply animate-pulse-soft" style={{animationDelay: '2s'}}></div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <FadeIn>
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-ice/30 border border-brand-ice mb-4 animate-fade-up">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-action opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-action"></span>
                            </span>
                            <span className="text-[10px] sm:text-xs font-semibold text-brand-primary tracking-wide uppercase">Start Selling Safely</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-brand-primary tracking-tight">Create Payment Link</h1>
                        <p className="text-brand-secondary mt-3 text-lg font-light">Secure escrow for your social commerce sales.</p>
                    </div>
                </FadeIn>

                {step === 'connect' && (
                    <FadeIn className="max-w-lg mx-auto">
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-10 text-center border border-white/50 ring-1 ring-black/5">
                            <div className="w-20 h-20 bg-brand-surfaceHighlight rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-border">
                                <Package size={32} className="text-brand-action" />
                            </div>
                            <h2 className="text-2xl font-bold text-brand-primary mb-3">Connect Your Wallet</h2>
                            <p className="text-brand-secondary mb-8 font-light">Connect your Solana wallet to create secure payment links and receive funds.</p>
                            <Button onClick={handleConnect} size="lg" variant="primary" className="w-full shadow-lg shadow-brand-action/20">
                                Connect Wallet
                            </Button>
                        </div>
                    </FadeIn>
                )}

                {step === 'create' && (
                    <FadeIn className="max-w-2xl mx-auto">
                        <form onSubmit={handleCreate} className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/50 ring-1 ring-black/5">
                            <div className="grid gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-brand-primary mb-2">Item Name</label>
                                    <input
                                        type="text"
                                        value={itemName}
                                        onChange={(e) => setItemName(e.target.value)}
                                        className="w-full bg-white/50 border border-brand-border rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-brand-action/20 focus:border-brand-action transition-all outline-none"
                                        placeholder="E.g., Vintage Nike Jordan"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-brand-primary mb-2">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
                                    <textarea
                                        value={itemDescription}
                                        onChange={(e) => setItemDescription(e.target.value)}
                                        className="w-full bg-white/50 border border-brand-border rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-brand-action/20 focus:border-brand-action transition-all outline-none resize-none"
                                        rows={3}
                                        placeholder="Condition, size, color, or any specific details..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-brand-primary mb-2">Price</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full bg-white/50 border border-brand-border rounded-xl px-4 py-3.5 pl-10 focus:ring-2 focus:ring-brand-action/20 focus:border-brand-action transition-all outline-none font-medium text-brand-primary"
                                                placeholder="0.00"
                                                required
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                                                {currencyConfig[fiatCurrency].symbol}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-brand-primary mb-2">Currency</label>
                                        <select
                                            value={fiatCurrency}
                                            onChange={(e) => setFiatCurrency(e.target.value as any)}
                                            className="w-full bg-white/50 border border-brand-border rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-brand-action/20 focus:border-brand-action transition-all outline-none appearance-none"
                                        >
                                            {Object.entries(currencyConfig).map(([code, cfg]) => (
                                                <option key={code} value={code}>{cfg.flag} {code} - {cfg.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-brand-primary mb-2">Auto-Release Duration</label>
                                    <p className="text-xs text-brand-secondary mb-3">Funds automatically release if buyer does not confirm delivery.</p>
                                    <div className="relative">
                                        <select
                                            value={releaseDuration}
                                            onChange={(e) => setReleaseDuration(parseInt(e.target.value))}
                                            className="w-full bg-white/50 border border-brand-border rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-brand-action/20 focus:border-brand-action transition-all outline-none appearance-none"
                                        >
                                            <option value={86400}>24 Hours</option>
                                            <option value={259200}>3 Days</option>
                                            <option value={604800}>7 Days</option>
                                            <option value={1209600}>14 Days</option>
                                        </select>
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm flex gap-3 items-start">
                                        <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <Button variant="primary" size="lg" className="w-full shadow-lg shadow-brand-action/20 text-base py-4" disabled={isLoading}>
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Loader2 className="animate-spin" size={20} /> Deploying Escrow...
                                            </span>
                                        ) : (
                                            'Generate Payment Link'
                                        )}
                                    </Button>
                                </div>
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
