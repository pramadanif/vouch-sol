import React, { useEffect, useState } from 'react';
import { Star, Shield, CheckCircle2, TrendingUp, Award } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { getProgram, getSellerProfilePda } from '@/lib/solana';
import { VOUCH_ESCROW_IDL } from '@/lib/idl/vouch_escrow';

interface SellerProfileData {
    totalTransactions: number;
    ratingSum: number;
    ratingCount: number;
    disputesWon: number;
    isVerified: boolean;
}

export default function SellerReputation({ sellerAddress }: { sellerAddress: string }) {
    const { publicKey, connected, signTransaction } = useWallet();
    const [profile, setProfile] = useState<SellerProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProfile() {
            if (!sellerAddress) return;
            try {
                const sellerPubkey = new PublicKey(sellerAddress);
                const profilePda = getSellerProfilePda(sellerPubkey);
                
                // Use a dummy wallet for fetching if not connected
                const dummyWallet = { publicKey: sellerPubkey, signTransaction: async (tx: any) => tx };
                const program = getProgram(dummyWallet as any, VOUCH_ESCROW_IDL);
                
                const account = await program.account.sellerProfile.fetch(profilePda);
                setProfile({
                    totalTransactions: account.totalTransactions.toNumber(),
                    ratingSum: account.ratingSum.toNumber(),
                    ratingCount: account.ratingCount.toNumber(),
                    disputesWon: account.disputesWon.toNumber(),
                    isVerified: account.verified
                });
            } catch (err) {
                console.error("Failed to fetch seller profile:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchProfile();
    }, [sellerAddress]);

    if (loading) return (
        <div className="animate-pulse flex items-center gap-4 bg-white/50 rounded-2xl p-4 border border-brand-border">
            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
            </div>
        </div>
    );

    if (!profile) return null;

    const avgRating = profile.ratingCount > 0 ? (profile.ratingSum / profile.ratingCount).toFixed(1) : 'N/A';

    return (
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-brand-border/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-ice/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
            
            <div className="flex items-center gap-5 relative z-10">
                <div className="w-16 h-16 bg-brand-surfaceHighlight rounded-2xl flex items-center justify-center relative">
                    <Shield size={32} className="text-brand-action" />
                    {profile.isVerified && (
                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1 border-2 border-white shadow-sm">
                            <CheckCircle2 size={14} />
                        </div>
                    )}
                </div>
                
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-brand-primary">Seller Reputation</h4>
                        {profile.isVerified && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">
                                Vouch Verified
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Star size={14} className="text-amber-400 fill-amber-400" />
                            <span className="text-sm font-bold text-brand-primary">{avgRating}</span>
                            <span className="text-xs text-brand-secondary">({profile.ratingCount} reviews)</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <div className="flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-brand-action" />
                            <span className="text-sm font-bold text-brand-primary">{profile.totalTransactions}</span>
                            <span className="text-xs text-brand-secondary">deals</span>
                        </div>
                    </div>
                </div>
                
                <div className="hidden sm:block text-right">
                    <div className="flex items-center gap-1.5 justify-end text-brand-accent mb-1">
                        <Award size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">Level 1</span>
                    </div>
                    <p className="text-[10px] text-brand-secondary font-medium">Reputation Score: {profile.totalTransactions * 10 + profile.ratingSum}</p>
                </div>
            </div>
        </div>
    );
}
