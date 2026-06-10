"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Coins,
  Loader2,
  Wallet,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const HIVE_MINT = "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS";
const HIVE_DECIMALS = 6;

type StakeData = {
  activeAmount: number;
  lockedAmount: number;
  slashedAmount: number;
  status: string;
  tier: string;
  tierInfo: null | {
    label: string;
    threshold: number;
    routingDiscountBps: number;
    pointsMultiplier: number;
    governanceMultiplier: number;
    benefits: string[];
  };
  solanaAddress: string | null;
  solanaAddressVerified?: boolean;
};

const tierCards = [
  {
    label: "Staker",
    amount: "10K HIVE",
    discount: "5%",
    points: "1.25x",
    governance: "1.0x",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  {
    label: "Power Staker",
    amount: "100K HIVE",
    discount: "10%",
    points: "1.5x",
    governance: "1.25x",
    color: "text-blue-400",
    border: "border-blue-500/20",
  },
  {
    label: "Governor",
    amount: "1M HIVE",
    discount: "20%",
    points: "2x",
    governance: "2.0x",
    color: "text-amber-400",
    border: "border-amber-500/20",
  },
];

export default function StakePage() {
  const { authenticated, ready, login, user } = useAuth();
  const [stake, setStake] = useState<StakeData | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [amount, setAmount] = useState("10000");
  const [loading, setLoading] = useState(false);
  const [staking, setStaking] = useState(false);
  const [treasuryWallet, setTreasuryWallet] = useState<string | null>(null);

  const userAddress = user?.wallet?.address || "";
  const linkedSolanaAddress = profile?.solanaAddress || null;

  const currentBenefits = useMemo(() => {
    if (!stake?.tierInfo) return ["Stake 10,000 HIVE to unlock premium access, routing discounts, and DAO voting."];
    return stake.tierInfo.benefits;
  }, [stake]);

  const fetchStake = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const [stakeRes, profileRes] = await Promise.all([
        fetch("/api/staking"),
        userAddress ? fetch(`/api/clients/profile?address=${encodeURIComponent(userAddress)}`) : Promise.resolve(null),
      ]);

      if (stakeRes.ok) {
        const data = await stakeRes.json();
        setStake(data.stake);
        setTreasuryWallet(data.treasuryWallet || null);
      }

      if (profileRes && "ok" in profileRes && profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.profile || null);
      }
    } catch (error) {
      console.error("Stake fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, [authenticated, userAddress]);

  useEffect(() => {
    fetchStake();
  }, [fetchStake]);

  const handleStake = async () => {
    if (!authenticated) {
      login();
      return;
    }
    if (!linkedSolanaAddress) {
      toast.error("Link a Solana wallet in your dashboard before staking.");
      return;
    }
    if (stake?.solanaAddressVerified === false) {
      toast.error("Re-link your Solana wallet from the dashboard so Hive can verify ownership before staking.");
      return;
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid HIVE amount.");
      return;
    }

    setStaking(true);
    try {
      if (!treasuryWallet) {
        throw new Error("Staking treasury is not configured. Try again shortly.");
      }

      const holderRes = await fetch(`/api/token/verify-holder?wallet=${encodeURIComponent(linkedSolanaAddress)}`);
      const holderData = await holderRes.json().catch(() => ({}));
      if (!holderRes.ok) {
        throw new Error(holderData.error || "Could not check HIVE balance before staking.");
      }
      if ((holderData.balance || 0) <= 0) {
        throw new Error("No HIVE found in this Solana wallet. Add HIVE to the linked wallet before staking.");
      }
      if ((holderData.balance || 0) < amountNum) {
        throw new Error(`Insufficient HIVE balance. Wallet has ${holderData.balance.toLocaleString()} HIVE.`);
      }

      const solanaWallet = (window as any).solana
        || (window as any).phantom?.solana
        || (window as any).solflare
        || (window as any).backpack?.solana;

      if (!solanaWallet) {
        throw new Error("No Solana wallet provider found.");
      }
      if (!solanaWallet.isConnected) {
        await solanaWallet.connect();
      }

      const { Connection, PublicKey, Transaction } = await import("@solana/web3.js");
      const {
        getAssociatedTokenAddress,
        createTransferInstruction,
        createAssociatedTokenAccountInstruction,
        getAccount,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      } = await import("@solana/spl-token");

      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed"
      );
      const senderKey = new PublicKey(linkedSolanaAddress);
      const treasuryKey = new PublicKey(treasuryWallet);
      const hiveMint = new PublicKey(HIVE_MINT);
      const senderAta = await getAssociatedTokenAddress(hiveMint, senderKey);
      const treasuryAta = await getAssociatedTokenAddress(hiveMint, treasuryKey);

      const transaction = new Transaction();
      try {
        await getAccount(connection, treasuryAta);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            senderKey,
            treasuryAta,
            treasuryKey,
            hiveMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      transaction.add(
        createTransferInstruction(
          senderAta,
          treasuryAta,
          senderKey,
          BigInt(Math.round(amountNum * Math.pow(10, HIVE_DECIMALS))),
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderKey;

      const signedTx = await solanaWallet.signTransaction(transaction);
      const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        {
          signature: txSignature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      const res = await fetch("/api/staking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txSignature,
          solanaAddress: linkedSolanaAddress,
          amountHive: amountNum,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Stake verification failed.");
      }

      toast.success(`Staked ${result.stake.addedAmount.toLocaleString()} HIVE.`);
      setStake(result.stake);
      fetchStake();
    } catch (error: any) {
      toast.error(error.message || "Staking failed.");
    } finally {
      setStaking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
            <section>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-4">
                HIVE Staking
              </h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 max-w-2xl">
                <Metric label="Minimum" value="10K HIVE" />
                <Metric label="Top Discount" value="20%" />
                <Metric label="Top Points" value="2x" />
                <Metric label="Voting" value="Staked" />
              </div>
            </section>

            <section className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Your Stake</p>
                  <div className="text-3xl font-mono font-bold mt-1">
                    {loading ? "..." : `${(stake?.activeAmount || 0).toLocaleString()} HIVE`}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-lg border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center">
                  <Coins className="text-emerald-400" size={20} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-5">
                <Metric label="Tier" value={stake?.tierInfo?.label || "None"} />
                <Metric label="Discount" value={stake?.tierInfo ? `${stake.tierInfo.routingDiscountBps / 100}%` : "0%"} />
                <Metric label="Points" value={stake?.tierInfo ? `${stake.tierInfo.pointsMultiplier}x` : "1x"} />
              </div>

              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Amount</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="min-w-0 flex-1 bg-black/60 border border-white/10 rounded px-3 py-3 text-sm font-mono outline-none focus:border-emerald-500/40"
                  placeholder="10000"
                />
                <button
                  onClick={handleStake}
                  disabled={!ready || staking}
                  className="inline-flex items-center gap-2 bg-white text-black px-4 py-3 rounded font-bold text-sm disabled:opacity-50"
                >
                  {staking ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                  Stake
                </button>
              </div>

              {!authenticated ? (
                <button onClick={() => login()} className="mt-4 text-sm text-emerald-400 hover:text-emerald-300">
                  Sign in to stake HIVE
                </button>
              ) : !linkedSolanaAddress ? (
                <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
                  Link a Solana wallet <ArrowRight size={14} />
                </Link>
              ) : stake?.solanaAddressVerified === false ? (
                <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
                  Re-link wallet to verify ownership <ArrowRight size={14} />
                </Link>
              ) : (
                <p className="mt-4 text-[11px] font-mono text-zinc-500 truncate">Wallet: {linkedSolanaAddress}</p>
              )}
            </section>
          </div>

          <section className="mt-14">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Staking Tiers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tierCards.map((tier) => (
                <div key={tier.label} className={`border ${tier.border} bg-[#0A0A0A] rounded-lg p-5`}>
                  <h3 className={`font-bold ${tier.color}`}>{tier.label}</h3>
                  <p className="text-2xl font-mono font-black mt-2">{tier.amount}</p>
                  <div className="mt-5 space-y-2 text-sm text-zinc-400">
                    <Benefit label={`${tier.discount} routing discount`} />
                    <Benefit label={`${tier.points} Hive Points`} />
                    <Benefit label={`${tier.governance} governance multiplier`} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14 border border-white/10 bg-white/[0.03] rounded-lg p-5">
            <h2 className="font-bold mb-4">Current Benefits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentBenefits.map((benefit) => (
                <Benefit key={benefit} label={benefit} />
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/40 rounded p-3">
      <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">{label}</div>
      <div className="text-sm font-mono font-bold mt-1 truncate">{value}</div>
    </div>
  );
}

function Benefit({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <CheckCircle size={14} className="text-emerald-400 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
