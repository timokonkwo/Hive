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
  ArrowUpRight,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { SwapWidget } from "@/components/token/SwapWidget";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { toast } from "sonner";

const HIVE_MINT = "6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS";
const HIVE_DECIMALS = 9;
const MIN_ACTIVE_STAKE_HIVE = 100_000;

const getClientSolanaRpcEndpoint = () => {
  if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/solana/rpc`;
  }
  return "/api/solana/rpc";
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseHiveAmountToRaw(amount: string) {
  const text = amount.trim();
  if (!/^\d+(\.\d{1,9})?$/.test(text)) return null;
  const [wholePart, fractionalPart = ""] = text.split(".");
  return (
    BigInt(wholePart || "0") * BigInt(Math.pow(10, HIVE_DECIMALS)) +
    BigInt(fractionalPart.padEnd(HIVE_DECIMALS, "0") || "0")
  );
}

async function confirmSignatureByPolling(
  connection: any,
  signature: string,
  lastValidBlockHeight: number
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    const status = (await connection.getSignatureStatuses([signature]))?.value?.[0];
    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }
    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return;
    }

    const blockHeight = await connection.getBlockHeight("confirmed");
    if (blockHeight > lastValidBlockHeight) {
      throw new Error("Transaction expired before confirmation. Try again.");
    }
    await wait(1_500);
  }
  throw new Error("Transaction sent but not confirmed in time. Verify wallet history.");
}

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
  pendingUnstakes?: Array<{
    id: string;
    amount: number;
    status: string;
    requestedAt: string;
    unlocksAt: string;
    claimTxSignature?: string;
    slashedAmount?: number;
  }>;
};

async function createSolanaWalletProof(solWallet: any, address: string, action = "link_wallet") {
  if (!solWallet.signMessage) {
    throw new Error("Solana wallet does not support message signing. Use Phantom, Solflare, or Backpack.");
  }
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
    amount: "100K+ HIVE",
    discount: "5%",
    points: "1.25x",
    governance: "1.0x",
    highlight: false,
  },
  {
    label: "Power Staker",
    amount: "1M+ HIVE",
    discount: "10%",
    points: "1.5x",
    governance: "1.25x",
    highlight: true,
  },
  {
    label: "Governor",
    amount: "10M+ HIVE",
    discount: "20%",
    points: "2x",
    governance: "2.0x",
    highlight: false,
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
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [unstaking, setUnstaking] = useState(false);
  const [claimingUnstakeId, setClaimingUnstakeId] = useState<string | null>(null);

  const userAddress = user?.wallet?.address || "";
  const isSolanaAuthWallet =
    user?.wallet?.chainType === "solana" &&
    !!userAddress &&
    !userAddress.startsWith("did:") &&
    !userAddress.startsWith("0x");
  const connectedSolanaAddress = isSolanaAuthWallet ? userAddress : null;
  const linkedSolanaAddress = profile?.solanaAddress || null;
  const stakingSolanaAddress = connectedSolanaAddress || linkedSolanaAddress;
  const profileWalletVerified =
    !!profile?.solanaAddressVerifiedAt || stake?.solanaAddressVerified === true;

  const currentBenefits = useMemo(() => {
    if (!stake?.tierInfo) {
      return ["Stake 100,000 HIVE to unlock routing discounts, priority dispatch, and DAO voting power."];
    }
    return stake.tierInfo.benefits;
  }, [stake]);

  const pendingUnstakes = useMemo(
    () =>
      Array.isArray(stake?.pendingUnstakes)
        ? stake.pendingUnstakes.filter((request) => request.status !== "claimed")
        : [],
    [stake]
  );
  const showUnstakeControls =
    authenticated &&
    ((stake?.activeAmount || 0) > 0 ||
      (stake?.lockedAmount || 0) > 0 ||
      pendingUnstakes.length > 0);

  const fetchStake = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const [stakeRes, profileRes] = await Promise.all([
        authFetch("/api/staking"),
        userAddress
          ? fetch(`/api/clients/profile?address=${encodeURIComponent(userAddress)}`)
          : Promise.resolve(null),
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

  const getSolanaWalletProvider = () =>
    (window as any).solana ||
    (window as any).phantom?.solana ||
    (window as any).solflare ||
    (window as any).backpack?.solana;

  const ensureVerifiedSolanaLink = async (address: string) => {
    if (linkedSolanaAddress === address && profileWalletVerified) return;

    const solanaWallet = getSolanaWalletProvider();
    if (!solanaWallet) {
      throw new Error("No Solana wallet provider found. Install Phantom, Solflare, or Backpack.");
    }
    const response = solanaWallet.isConnected ? null : await solanaWallet.connect();
    const providerAddress = (response?.publicKey || solanaWallet.publicKey)?.toString?.();
    if (!providerAddress) {
      throw new Error("Could not read connected Solana wallet address.");
    }
    if (providerAddress !== address) {
      throw new Error(
        `Connected wallet mismatch. Expected ${address.slice(0, 6)}...${address.slice(
          -4
        )} but provider returned ${providerAddress.slice(0, 6)}...${providerAddress.slice(-4)}.`
      );
    }

    const walletProof = await createSolanaWalletProof(solanaWallet, address);
    const res = await authFetch("/api/clients/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: userAddress, solanaAddress: address, walletProof }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || "Could not verify connected Solana wallet.");
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
    const rawAmount = parseHiveAmountToRaw(amount);
    if (!rawAmount) {
      toast.error(`Enter a HIVE amount with up to ${HIVE_DECIMALS} decimals.`);
      return;
    }

    setStaking(true);
    try {
      if (!treasuryWallet) {
        throw new Error("Staking treasury is not configured. Try again shortly.");
      }
      await ensureVerifiedSolanaLink(stakingSolanaAddress);

      const holderRes = await fetch(
        `/api/token/verify-holder?wallet=${encodeURIComponent(stakingSolanaAddress)}`
      );
      const holderData = await holderRes.json().catch(() => ({}));
      if (!holderRes.ok) {
        throw new Error(holderData.error || "Could not check HIVE balance before staking.");
      }
      if ((holderData.balance || 0) <= 0) {
        throw new Error("No HIVE found in linked Solana wallet. Add HIVE before staking.");
      }
      if ((holderData.balance || 0) < amountNum) {
        throw new Error(
          `Insufficient HIVE balance. Wallet contains ${holderData.balance.toLocaleString()} HIVE.`
        );
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

      const connection = new Connection(getClientSolanaRpcEndpoint(), "confirmed");
      const walletAddress = solanaWallet.publicKey?.toString?.();
      if (walletAddress && walletAddress !== stakingSolanaAddress) {
        throw new Error("Active Solana wallet does not match staking wallet.");
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
          rawAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = senderKey;

      const signedTx = await solanaWallet.signTransaction(transaction);
      const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await confirmSignatureByPolling(
        connection,
        txSignature,
        latestBlockhash.lastValidBlockHeight
      );

      const res = await authFetch("/api/staking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txSignature,
          solanaAddress: stakingSolanaAddress,
          amountHive: amount.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Stake verification failed.");
      }

      toast.success(`Successfully staked ${result.stake.addedAmount.toLocaleString()} HIVE.`);
      setStake(result.stake);
      fetchStake();
      fetchHiveBalance(stakingSolanaAddress);
    } catch (error: any) {
      toast.error(error.message || "Staking failed.");
    } finally {
      setStaking(false);
    }
  };

  const handleRequestUnstake = async () => {
    if (!authenticated) {
      login();
      return;
    }
    const amountNum = Number(unstakeAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid HIVE amount to unstake.");
      return;
    }
    if (amountNum > (stake?.activeAmount || 0)) {
      toast.error("Unstake amount cannot exceed active stake.");
      return;
    }

    setUnstaking(true);
    try {
      const res = await authFetch("/api/staking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_unstake", amountHive: amountNum }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Unstake request failed.");
      }
      setStake(result.stake);
      setUnstakeAmount("");
      toast.success(
        `Unstake requested. Claim unlock date: ${new Date(
          result.request.unlocksAt
        ).toLocaleDateString()}.`
      );
      fetchStake();
    } catch (error: any) {
      toast.error(error.message || "Unstake request failed.");
    } finally {
      setUnstaking(false);
    }
  };

  const handleClaimUnstake = async (requestId: string) => {
    if (!authenticated) {
      login();
      return;
    }

    setClaimingUnstakeId(requestId);
    try {
      const res = await authFetch("/api/staking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_unstake", requestId }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Unstake claim failed.");
      }
      setStake(result.stake);
      toast.success(`Claimed ${result.claimedAmount.toLocaleString()} HIVE.`);
      fetchStake();
      fetchHiveBalance(stakingSolanaAddress);
    } catch (error: any) {
      toast.error(error.message || "Unstake claim failed.");
    } finally {
      setClaimingUnstakeId(null);
    }
  };

  const copyCA = () => {
    navigator.clipboard.writeText(HIVE_MINT);
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-token-bg text-token-text selection:bg-[#00C805] selection:text-black">
      <Navbar />
      
      <main className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          {/* Header Banner */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-token-border">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <RobinhoodBadge label="Robinhood & Solana Staking" variant="live" />
                <span className="text-xs font-mono text-token-dim">Staking Engine v2.0</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-token-text uppercase">
                <span className="text-[#00C805]">$HIVE</span> Staking
              </h1>
              <p className="text-token-dim text-sm max-w-xl mt-2 leading-relaxed">
                Stake protocol tokens to unlock task fee discounts, point multipliers, and DAO slashing governance.
              </p>

              {/* Token Contract Chip */}
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-token-subtle border border-token-border">
                <span className="text-[10px] font-mono text-token-dim uppercase tracking-wider font-semibold">Contract</span>
                <span className="text-xs font-mono text-token-text">
                  <span className="sm:hidden">{HIVE_MINT.slice(0, 6)}...{HIVE_MINT.slice(-4)}</span>
                  <span className="hidden sm:inline">{HIVE_MINT}</span>
                </span>
                <button
                  onClick={copyCA}
                  className="text-token-dim hover:text-token-text p-1 transition-colors"
                  title="Copy Mint Address"
                >
                  {caCopied ? <Check size={12} className="text-[#00C805]" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              <HeaderMetric label="Minimum Stake" value="100K HIVE" />
              <HeaderMetric label="Fee Discount" value="Up to 20%" />
              <HeaderMetric label="Point Boost" value="Up to 2.0x" />
              <HeaderMetric label="Lock Duration" value="7 Days" />
            </div>
          </div>

          {/* Main Grid: Staking Dashboard + Swap Widget */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8 items-start">
            {/* Left Area: Staking Positions & Form */}
            <div className="lg:col-span-7 space-y-6">
              {/* Account Telemetry Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="robin-card p-5 bg-token-surface border border-token-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-token-dim">Wallet Balance</span>
                    {balanceLoading ? (
                      <Loader2 size={14} className="animate-spin text-token-dim" />
                    ) : (
                      <Coins size={16} className="text-[#00C805]" />
                    )}
                  </div>
                  <div className="text-2xl font-mono font-bold mt-3 text-token-text">
                    {balanceLoading
                      ? "..."
                      : hiveBalance === null
                      ? "Not Connected"
                      : `${hiveBalance.toLocaleString()} HIVE`}
                  </div>
                  <p className="text-[11px] font-mono text-token-dim mt-2 truncate">
                    {balanceMessage || (stakingSolanaAddress ? stakingSolanaAddress : "Connect Solana wallet")}
                  </p>
                </div>

                <div className="robin-card p-5 bg-token-surface border border-token-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-token-dim">Active Stake</span>
                    <Shield size={16} className="text-[#00C805]" />
                  </div>
                  <div className="text-2xl font-mono font-bold mt-3 text-token-text">
                    {loading ? "..." : `${(stake?.activeAmount || 0).toLocaleString()} HIVE`}
                  </div>
                  <p className="text-[11px] font-mono text-token-dim mt-2">
                    Tier: <span className="text-[#00C805] font-semibold">{stake?.tierInfo?.label || "None"}</span>
                  </p>
                </div>

                <div className="robin-card p-5 bg-token-surface border border-token-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-token-dim">Multiplier</span>
                    <Star size={16} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold mt-3 text-token-text">
                    {stake?.tierInfo ? `${stake.tierInfo.pointsMultiplier}x` : "1.0x"}
                  </div>
                  <p className="text-[11px] font-mono text-token-dim mt-2">
                    {stake?.tierInfo
                      ? `${stake.tierInfo.routingDiscountBps / 100}% task fee discount`
                      : "Stake to activate boost"}
                  </p>
                </div>
              </div>

              {/* Deposit Staking Form */}
              <div className="robin-card p-6 bg-token-surface border border-token-border">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#00C805] font-bold">
                      Protocol Deposit
                    </span>
                    <h2 className="text-xl font-bold mt-1 text-token-text">Stake $HIVE Tokens</h2>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#00C805]/10 border border-[#00C805]/20 flex items-center justify-center text-[#00C805]">
                    <Wallet size={18} />
                  </div>
                </div>

                {/* Benefits Pill Strip */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="p-3 bg-token-subtle border border-token-border rounded-lg text-center">
                    <div className="text-[10px] font-mono uppercase text-token-dim">Status Tier</div>
                    <div className="text-sm font-mono font-bold mt-1 text-token-text">{stake?.tierInfo?.label || "None"}</div>
                  </div>
                  <div className="p-3 bg-token-subtle border border-token-border rounded-lg text-center">
                    <div className="text-[10px] font-mono uppercase text-token-dim">Fee Rebate</div>
                    <div className="text-sm font-mono font-bold mt-1 text-[#00C805]">
                      {stake?.tierInfo ? `${stake.tierInfo.routingDiscountBps / 100}%` : "0%"}
                    </div>
                  </div>
                  <div className="p-3 bg-token-subtle border border-token-border rounded-lg text-center">
                    <div className="text-[10px] font-mono uppercase text-token-dim">Points Boost</div>
                    <div className="text-sm font-mono font-bold mt-1 text-token-text">
                      {stake?.tierInfo ? `${stake.tierInfo.pointsMultiplier}x` : "1.0x"}
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <label className="text-[11px] font-mono uppercase tracking-wider text-token-dim">
                  Deposit Quantity (HIVE)
                </label>
                <div className="mt-2 flex gap-3">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-token-subtle border border-token-border rounded-xl px-4 py-3 text-base font-mono text-token-text outline-none focus:border-[#00C805]"
                    placeholder="100000"
                  />
                  <button
                    onClick={handleStake}
                    disabled={!ready || staking}
                    className="inline-flex items-center gap-2 bg-[#00C805] hover:bg-[#00B004] text-black px-6 py-3 rounded-xl font-bold font-mono text-xs uppercase tracking-wider disabled:opacity-40 transition-all shadow-[0_4px_16px_rgba(0,200,5,0.25)]"
                  >
                    {staking ? <Loader2 size={16} className="animate-spin text-black" /> : <Wallet size={16} />}
                    Stake Tokens
                  </button>
                </div>

                {!authenticated ? (
                  <button
                    onClick={() => login()}
                    className="mt-4 text-xs font-mono text-[#00C805] hover:underline"
                  >
                    Sign in to link wallet and stake
                  </button>
                ) : stakingSolanaAddress ? (
                  <p className="mt-4 text-[11px] font-mono text-token-dim truncate">
                    Staking Account: <span className="text-token-text">{stakingSolanaAddress}</span>
                    {connectedSolanaAddress && linkedSolanaAddress !== connectedSolanaAddress
                      ? " (Verification required on submit)"
                      : ""}
                  </p>
                ) : (
                  <p className="mt-4 text-xs text-amber-500 font-mono">
                    Connect a Solana wallet to initiate token staking.
                  </p>
                )}

                {/* Unstake Management Area */}
                {showUnstakeControls && (
                  <div className="mt-8 pt-6 border-t border-token-border">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-sm text-token-text uppercase tracking-wider">
                        Cooldown & Unstake
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-token-dim">
                        <Clock size={12} />
                        <span>7-Day Protocol Cooldown</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 bg-token-subtle rounded-lg border border-token-border">
                        <span className="text-[10px] font-mono uppercase text-token-dim">Locked Tokens</span>
                        <div className="text-sm font-mono font-bold mt-1 text-token-text">
                          {(stake?.lockedAmount || 0).toLocaleString()} HIVE
                        </div>
                      </div>
                      <div className="p-3 bg-token-subtle rounded-lg border border-token-border">
                        <span className="text-[10px] font-mono uppercase text-token-dim">Active Capacity</span>
                        <div className="text-sm font-mono font-bold mt-1 text-token-text">
                          {(stake?.activeAmount || 0).toLocaleString()} HIVE
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <input
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        inputMode="decimal"
                        className="min-w-0 flex-1 bg-token-subtle border border-token-border rounded-xl px-4 py-3 text-sm font-mono text-token-text outline-none focus:border-amber-500"
                        placeholder="Amount to withdraw"
                      />
                      <button
                        onClick={handleRequestUnstake}
                        disabled={!authenticated || unstaking || (stake?.activeAmount || 0) <= 0}
                        className="inline-flex items-center gap-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 px-5 py-3 rounded-xl font-bold font-mono text-xs uppercase disabled:opacity-40 transition-all"
                      >
                        {unstaking ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                        Initiate Unstake
                      </button>
                    </div>

                    {/* Pending Claims List */}
                    {pendingUnstakes.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {pendingUnstakes.map((request) => {
                          const isClaimable =
                            request.status === "cooldown" &&
                            new Date(request.unlocksAt).getTime() <= Date.now();
                          return (
                            <div
                              key={request.id}
                              className="flex items-center justify-between gap-3 p-3 bg-token-subtle border border-token-border rounded-xl"
                            >
                              <div>
                                <div className="text-sm font-mono font-bold text-token-text">
                                  {request.amount.toLocaleString()} HIVE
                                </div>
                                <div className="text-[10px] font-mono text-token-dim">
                                  {request.status === "slashed"
                                    ? `Slashed${
                                        request.slashedAmount
                                          ? `: ${request.slashedAmount.toLocaleString()} HIVE`
                                          : ""
                                      }`
                                    : `Available to claim: ${new Date(request.unlocksAt).toLocaleDateString()}`}
                                </div>
                              </div>

                              {request.status === "slashed" ? (
                                <span className="text-[10px] font-mono uppercase text-red-500 font-bold">
                                  Slashed
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleClaimUnstake(request.id)}
                                  disabled={!isClaimable || claimingUnstakeId === request.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00C805]/10 border border-[#00C805]/30 text-[#00C805] text-xs font-mono font-bold uppercase disabled:opacity-40 hover:bg-[#00C805]/20 transition-all"
                                >
                                  {claimingUnstakeId === request.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  Claim
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Area: Liquidity & Instant Swap Router */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
              <SwapWidget />

              {/* Verified Staking Guarantee Card */}
              <div className="robin-card p-5 bg-token-surface border border-token-border">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-[#00C805]" />
                  <h3 className="font-bold text-sm text-token-text">Network Settlement Guarantee</h3>
                </div>
                <p className="text-xs text-token-dim leading-relaxed">
                  Staked tokens are locked directly on-chain in verified smart contracts. No intermediary can freeze or redirect your deposit.
                </p>
                <div className="mt-4 pt-3 border-t border-token-border flex items-center justify-between text-[11px] font-mono text-token-dim">
                  <span>Settlement: Solana & Robinhood</span>
                  <Link href="/docs#staking" className="text-[#00C805] hover:underline inline-flex items-center gap-1">
                    Protocol Docs <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Staking Tiers Specification Matrix */}
          <section className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#00C805] font-bold">
                  Hierarchy
                </span>
                <h2 className="text-2xl font-black uppercase text-token-text tracking-tight mt-1">
                  Staking Tier Privileges
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {tierCards.map((tier) => (
                <div
                  key={tier.label}
                  className={`robin-card p-6 bg-token-surface border transition-all ${
                    tier.highlight
                      ? "border-[#00C805] shadow-[0_4px_24px_rgba(0,200,5,0.15)]"
                      : "border-token-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-base text-token-text">{tier.label}</h3>
                    {tier.highlight && (
                      <span className="text-[10px] font-mono uppercase font-bold text-black bg-[#00C805] px-2 py-0.5 rounded">
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-mono font-black text-token-text mt-2">
                    {tier.amount}
                  </div>
                  <div className="mt-6 space-y-3">
                    <BenefitItem label={`${tier.discount} Execution Fee Discount`} />
                    <BenefitItem label={`${tier.points} Points Multiplier Boost`} />
                    <BenefitItem label={`${tier.governance} Governance Vote Weight`} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Current Active Privileges Matrix */}
          <section className="mt-8 robin-card p-6 bg-token-surface border border-token-border">
            <h3 className="font-bold text-base text-token-text mb-4">Active Account Entitlements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentBenefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm text-token-dim">
                  <CheckCircle size={15} className="text-[#00C805] shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-token-subtle border border-token-border rounded-xl">
      <div className="text-[10px] font-mono uppercase tracking-wider text-token-dim">{label}</div>
      <div className="text-sm font-mono font-bold text-token-text mt-1 truncate">{value}</div>
    </div>
  );
}

function BenefitItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono text-token-dim">
      <CheckCircle size={14} className="text-[#00C805] shrink-0" />
      <span>{label}</span>
    </div>
  );
}
