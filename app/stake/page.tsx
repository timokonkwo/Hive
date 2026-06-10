"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  Coins,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Shield,
  Star,
  Wallet,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { SwapWidget } from "@/components/token/SwapWidget";
import { toast } from "sonner";

const HIVE_MINT = "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS";
const HIVE_DECIMALS = 6;
const MIN_ACTIVE_STAKE_HIVE = 100_000;

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

async function createSolanaWalletProof(solWallet: any, address: string, action = "link_wallet") {
  if (!solWallet.signMessage) {
    throw new Error("Your Solana wallet does not support message signing. Use Phantom, Solflare, or Backpack.");
  }
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const timestamp = Date.now();
  const message = [
    "Hive Solana Wallet Proof",
    `Action: ${action}`,
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
  const signed = await solWallet.signMessage(new TextEncoder().encode(message), "utf8");
  const signatureBytes = signed?.signature || signed;
  const { default: bs58 } = await import("bs58");
  return {
    message,
    signature: bs58.encode(signatureBytes),
  };
}

const tierCards = [
  {
    label: "Staker",
    amount: "100K HIVE",
    discount: "5%",
    points: "1.25x",
    governance: "1.0x",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  {
    label: "Power Staker",
    amount: "1M HIVE",
    discount: "10%",
    points: "1.5x",
    governance: "1.25x",
    color: "text-blue-400",
    border: "border-blue-500/20",
  },
  {
    label: "Governor",
    amount: "10M HIVE",
    discount: "20%",
    points: "2x",
    governance: "2.0x",
    color: "text-amber-400",
    border: "border-amber-500/20",
  },
];

export default function StakePage() {
  const { authenticated, ready, login, user } = useAuth();
  const authFetch = useAuthFetch();
  const [stake, setStake] = useState<StakeData | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [amount, setAmount] = useState("100000");
  const [loading, setLoading] = useState(false);
  const [staking, setStaking] = useState(false);
  const [treasuryWallet, setTreasuryWallet] = useState<string | null>(null);
  const [hiveBalance, setHiveBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceMessage, setBalanceMessage] = useState("");
  const [caCopied, setCaCopied] = useState(false);

  const userAddress = user?.wallet?.address || "";
  const isSolanaAuthWallet = user?.wallet?.chainType === "solana" && !!userAddress && !userAddress.startsWith("did:") && !userAddress.startsWith("0x");
  const connectedSolanaAddress = isSolanaAuthWallet ? userAddress : null;
  const linkedSolanaAddress = profile?.solanaAddress || null;
  const stakingSolanaAddress = connectedSolanaAddress || linkedSolanaAddress;
  const profileWalletVerified = !!profile?.solanaAddressVerifiedAt || stake?.solanaAddressVerified === true;

  const currentBenefits = useMemo(() => {
    if (!stake?.tierInfo) return ["Stake 100,000 HIVE to unlock premium access, routing discounts, and DAO voting."];
    return stake.tierInfo.benefits;
  }, [stake]);

  const fetchStake = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const [stakeRes, profileRes] = await Promise.all([
        authFetch("/api/staking"),
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
  }, [authenticated, authFetch, userAddress]);

  useEffect(() => {
    fetchStake();
  }, [fetchStake]);

  const fetchHiveBalance = useCallback(async (wallet: string | null) => {
    if (!wallet) {
      setHiveBalance(null);
      setBalanceMessage("");
      return;
    }
    setBalanceLoading(true);
    setBalanceMessage("");
    try {
      const res = await fetch(`/api/token/verify-holder?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not check HIVE balance.");
      setHiveBalance(Number(data.balance || 0));
      setBalanceMessage(data.message || "");
    } catch (error: any) {
      setHiveBalance(null);
      setBalanceMessage(error.message || "Could not check HIVE balance.");
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHiveBalance(stakingSolanaAddress);
  }, [fetchHiveBalance, stakingSolanaAddress]);

  const getSolanaWalletProvider = () => (
    (window as any).solana
    || (window as any).phantom?.solana
    || (window as any).solflare
    || (window as any).backpack?.solana
  );

  const ensureVerifiedSolanaLink = async (address: string) => {
    if (linkedSolanaAddress === address && profileWalletVerified) return;

    const solanaWallet = getSolanaWalletProvider();
    if (!solanaWallet) {
      throw new Error("No Solana wallet provider found. Install Phantom, Solflare, or Backpack.");
    }
    const response = solanaWallet.isConnected ? null : await solanaWallet.connect();
    const providerAddress = (response?.publicKey || solanaWallet.publicKey)?.toString?.();
    if (!providerAddress) {
      throw new Error("Could not read the connected Solana wallet address.");
    }
    if (providerAddress !== address) {
      throw new Error(`Connected wallet mismatch. Expected ${address.slice(0, 6)}...${address.slice(-4)} but wallet provider returned ${providerAddress.slice(0, 6)}...${providerAddress.slice(-4)}.`);
    }

    const walletProof = await createSolanaWalletProof(solanaWallet, address);
    const res = await authFetch("/api/clients/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: userAddress, solanaAddress: address, walletProof }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || "Could not verify the connected Solana wallet.");
    }
    setProfile((prev: any) => ({
      ...(prev || {}),
      solanaAddress: address,
      solanaAddressVerifiedAt: new Date().toISOString(),
    }));
  };

  const handleStake = async () => {
    if (!authenticated) {
      login();
      return;
    }
    if (!stakingSolanaAddress) {
      toast.error("Connect a Solana wallet before staking.");
      return;
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid HIVE amount.");
      return;
    }
    if ((stake?.activeAmount || 0) + amountNum < MIN_ACTIVE_STAKE_HIVE) {
      toast.error(`Minimum active stake is ${MIN_ACTIVE_STAKE_HIVE.toLocaleString()} HIVE.`);
      return;
    }

    setStaking(true);
    try {
      if (!treasuryWallet) {
        throw new Error("Staking treasury is not configured. Try again shortly.");
      }
      await ensureVerifiedSolanaLink(stakingSolanaAddress);

      const holderRes = await fetch(`/api/token/verify-holder?wallet=${encodeURIComponent(stakingSolanaAddress)}`);
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

      const solanaWallet = getSolanaWalletProvider();

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
      const walletAddress = solanaWallet.publicKey?.toString?.();
      if (walletAddress && walletAddress !== stakingSolanaAddress) {
        throw new Error("The active Solana wallet does not match the staking wallet.");
      }

      const senderKey = new PublicKey(stakingSolanaAddress);
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

      const res = await authFetch("/api/staking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txSignature,
          solanaAddress: stakingSolanaAddress,
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
      fetchHiveBalance(stakingSolanaAddress);
    } catch (error: any) {
      toast.error(error.message || "Staking failed.");
    } finally {
      setStaking(false);
    }
  };

  const copyCA = () => {
    navigator.clipboard.writeText(HIVE_MINT);
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <section className="mb-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight">
                  <span className="text-emerald-500">$HIVE</span> Token
                </h1>
                <button
                  onClick={copyCA}
                  className="mt-5 inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-950 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <span className="text-[10px] font-mono text-zinc-600">CA</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    <span className="sm:hidden">{HIVE_MINT.slice(0, 6)}...{HIVE_MINT.slice(-4)}</span>
                    <span className="hidden sm:inline">{HIVE_MINT}</span>
                  </span>
                  {caCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-zinc-600" />}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full lg:w-auto">
                <Metric label="Stake Min" value="100K HIVE" />
                <Metric label="Top Discount" value="20%" />
                <Metric label="Top Points" value="2x" />
                <Metric label="Voting" value="Staked" />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            <section className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Wallet Balance</p>
                    {balanceLoading ? <Loader2 size={14} className="animate-spin text-zinc-500" /> : <Coins size={15} className="text-emerald-400" />}
                  </div>
                  <div className="text-2xl font-mono font-bold mt-3">
                    {balanceLoading ? "..." : hiveBalance === null ? "Not connected" : `${hiveBalance.toLocaleString()} HIVE`}
                  </div>
                  <p className={`text-[11px] font-mono mt-2 truncate ${hiveBalance === 0 ? "text-amber-400" : "text-zinc-600"}`}>
                    {balanceMessage || (stakingSolanaAddress ? stakingSolanaAddress : "Connect a Solana wallet")}
                  </p>
                </div>

                <div className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Active Stake</p>
                    <Shield size={15} className="text-blue-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold mt-3">
                    {loading ? "..." : `${(stake?.activeAmount || 0).toLocaleString()} HIVE`}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-600 mt-2">Tier: {stake?.tierInfo?.label || "None"}</p>
                </div>

                <div className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Access</p>
                    <Star size={15} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold mt-3">
                    {stake?.tierInfo ? `${stake.tierInfo.pointsMultiplier}x` : "1x"}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-600 mt-2">
                    {stake?.tierInfo ? `${stake.tierInfo.routingDiscountBps / 100}% routing discount` : "Stake to unlock discounts"}
                  </p>
                </div>
              </div>

              <section className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Stake HIVE</p>
                    <h2 className="text-xl font-bold mt-1">Lock tokens for routing, rewards, and DAO weight</h2>
                  </div>
                  <div className="w-11 h-11 rounded-lg border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center">
                    <Wallet className="text-emerald-400" size={20} />
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
                    placeholder="100000"
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
                ) : stakingSolanaAddress ? (
                  <p className="mt-4 text-[11px] font-mono text-zinc-500 truncate">
                    Wallet: {stakingSolanaAddress}
                    {connectedSolanaAddress && linkedSolanaAddress !== connectedSolanaAddress ? " · will verify on stake" : ""}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-amber-400">Connect with a Solana wallet to stake.</p>
                )}

                {hiveBalance === 0 && (
                  <a href={`https://bags.fm/${HIVE_MINT}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-emerald-400 hover:text-emerald-300">
                    Get HIVE <ExternalLink size={11} />
                  </a>
                )}
              </section>
            </section>

            <section className="lg:col-span-2 lg:sticky lg:top-24">
              <SwapWidget />
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
