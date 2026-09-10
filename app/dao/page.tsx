"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  FilePlus,
  Loader2,
  RefreshCw,
  Wallet,
  XCircle,
  ShieldAlert,
  Scale,
  Clock,
  ChevronRight,
  Gavel,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import { toast } from "sonner";

type Dispute = {
  id: string;
  providerAddress: string;
  toolId: string;
  reason: string;
  evidenceUri: string;
  stakedAmount: number;
  votesForSlash: number;
  votesAgainstSlash: number;
  voteCount: number;
  snapshotBlock: number;
  deadline: string;
  status: string;
  phase?: "evidence" | "voting" | "queued" | "resolved";
  evidenceOpenUntil?: string;
  votingStartsAt?: string;
  votingEndsAt?: string;
  quorumRequired?: number;
  slashThresholdBps?: number;
};

type DisputeReport = {
  id: string;
  providerAddress: string;
  toolId: string;
  category: string;
  reason: string;
  evidenceUri: string;
  status: string;
  triageReason?: string;
  disputeId?: string;
  affectedParty?: boolean;
  watchdogEligible?: boolean;
  createdAt: string;
};

async function createSolanaWalletProof(solWallet: any, address: string, action: string) {
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
  return { message, signature: bs58.encode(signatureBytes) };
}

export default function DaoPage() {
  const { authenticated, login, user, ready } = useAuth();
  const authFetch = useAuthFetch();
  const [profile, setProfile] = useState<any>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [reports, setReports] = useState<DisputeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);
  const [disputeForm, setDisputeForm] = useState({
    providerAddress: "",
    toolId: "",
    category: "failed_execution",
    evidenceUri: "",
    reason: "",
    sessionLedgerId: "",
  });

  const userAddress = user?.wallet?.address || "";
  const solanaAccountLinked = user?.linkedAccounts?.find(
    (a: any) => a.type === "wallet" && (a.chainType === "solana" || a.chainId?.startsWith?.("solana"))
  );
  const solanaAddress = profile?.solanaAddress || (solanaAccountLinked as any)?.address || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [disputesRes, profileRes, reportsRes] = await Promise.all([
        fetch("/api/disputes?status=active"),
        authenticated && userAddress
          ? fetch(`/api/clients/profile?address=${encodeURIComponent(userAddress)}`)
          : Promise.resolve(null),
        authenticated ? authFetch("/api/dispute-reports") : Promise.resolve(null),
      ]);

      if (disputesRes.ok) {
        const data = await disputesRes.json();
        setDisputes(data.disputes || []);
      }

      if (profileRes && "ok" in profileRes && profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.profile || null);
      }

      if (reportsRes && "ok" in reportsRes && reportsRes.ok) {
        const data = await reportsRes.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error("DAO load failed:", error);
      toast.error("Failed to load DAO disputes.");
    } finally {
      setLoading(false);
    }
  }, [authenticated, userAddress, authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const vote = async (disputeId: string, choice: "slash" | "dismiss") => {
    if (!authenticated) {
      login();
      return;
    }
    if (!solanaAddress) {
      toast.error("Connect a Solana wallet before voting.");
      return;
    }

    setVotingId(disputeId);
    try {
      const solanaWallet =
        (window as any).solana ||
        (window as any).phantom?.solana ||
        (window as any).solflare ||
        (window as any).backpack?.solana;

      if (!solanaWallet) throw new Error("No Solana wallet found.");
      if (!solanaWallet.isConnected) await solanaWallet.connect();

      const walletProof = await createSolanaWalletProof(
        solanaWallet,
        solanaAddress,
        `dao_vote:${disputeId}:${choice}`
      );

      const res = await authFetch("/api/disputes/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          vote: choice,
          solanaAddress,
          walletProof,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Vote failed.");
      }

      toast.success(`Vote submitted successfully: ${choice.toUpperCase()}`);
      load();
    } catch (error: any) {
      toast.error(error.message || "Vote failed.");
    } finally {
      setVotingId(null);
    }
  };

  const fileDispute = async (event: FormEvent) => {
    event.preventDefault();
    if (!authenticated) {
      login();
      return;
    }

    setFiling(true);
    try {
      const res = await authFetch("/api/dispute-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerAddress: disputeForm.providerAddress.trim(),
          toolId: disputeForm.toolId.trim(),
          category: disputeForm.category,
          evidenceUri: disputeForm.evidenceUri.trim(),
          reason: disputeForm.reason.trim(),
          sessionLedgerId: disputeForm.sessionLedgerId.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Report could not be submitted.");
      }
      toast.success("Incident report submitted for DAO review.");
      setDisputeForm({
        providerAddress: "",
        toolId: "",
        category: "failed_execution",
        evidenceUri: "",
        reason: "",
        sessionLedgerId: "",
      });
      load();
    } catch (error: any) {
      toast.error(error.message || "Report submission failed.");
    } finally {
      setFiling(false);
    }
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
                <RobinhoodBadge label="Stake-Weighted Governance" variant="live" />
                <span className="text-xs font-mono text-token-dim">DAO Court v2.0</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-token-text uppercase">
                DAO <span className="text-[#00C805]">Governance</span>
              </h1>
              <p className="text-token-dim text-sm max-w-xl mt-2 leading-relaxed">
                Review malicious outputs, slash rogue agent collateral, and vote with staked token weight.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-token-surface border border-token-border rounded-xl text-xs font-mono font-bold text-token-dim hover:text-token-text transition-all"
              >
                {loading ? <Loader2 size={13} className="animate-spin text-[#00C805]" /> : <RefreshCw size={13} />}
                Sync Court
              </button>
            </div>
          </div>

          {/* Wallet Alerts */}
          {!authenticated && (
            <div className="mt-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-amber-500">
                <Scale size={16} />
                <span>Sign in to verify your stake weight and participate in governance votes.</span>
              </div>
              <button
                onClick={() => login()}
                disabled={!ready}
                className="bg-token-text text-token-bg px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider"
              >
                Sign In
              </button>
            </div>
          )}

          {authenticated && !solanaAddress && (
            <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center gap-3 text-red-500 text-sm">
              <Wallet size={16} />
              <span>No Solana wallet linked. Connect a wallet to cast stake-weighted votes.</span>
            </div>
          )}

          {/* Main Grid: Submit Report & Active Court Cases */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 items-start">
            {/* Left Column: Submit Dispute Report */}
            <div className="lg:col-span-4 space-y-6">
              <form onSubmit={fileDispute} className="robin-card p-6 bg-token-surface border border-token-border">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#00C805] font-bold">
                      Protocol Court
                    </span>
                    <h2 className="text-base font-bold text-token-text mt-1">Submit Incident Report</h2>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-token-subtle border border-token-border flex items-center justify-center text-token-dim">
                    <FilePlus size={16} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-token-dim block mb-1.5">
                      Provider Solana Address
                    </label>
                    <input
                      value={disputeForm.providerAddress}
                      onChange={(e) => setDisputeForm((f) => ({ ...f, providerAddress: e.target.value }))}
                      placeholder="Solana public key"
                      className="w-full bg-token-subtle border border-token-border rounded-lg px-3 py-2.5 text-xs font-mono text-token-text outline-none focus:border-[#00C805]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-token-dim block mb-1.5">
                      Tool or Agent ID
                    </label>
                    <input
                      value={disputeForm.toolId}
                      onChange={(e) => setDisputeForm((f) => ({ ...f, toolId: e.target.value }))}
                      placeholder="Tool identifier"
                      className="w-full bg-token-subtle border border-token-border rounded-lg px-3 py-2.5 text-xs font-mono text-token-text outline-none focus:border-[#00C805]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-token-dim block mb-1.5">
                      Violation Category
                    </label>
                    <select
                      value={disputeForm.category}
                      onChange={(e) => setDisputeForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full bg-token-subtle border border-token-border rounded-lg px-3 py-2.5 text-xs font-mono text-token-text outline-none focus:border-[#00C805]"
                    >
                      <option value="failed_execution">Failed Execution</option>
                      <option value="malicious_output">Malicious Output</option>
                      <option value="billing">Billing Discrepancy</option>
                      <option value="uptime">Service Downtime</option>
                      <option value="policy">Policy Violation</option>
                      <option value="other">Other Fault</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-token-dim block mb-1.5">
                      Evidence URL (IPFS or HTTPS)
                    </label>
                    <input
                      value={disputeForm.evidenceUri}
                      onChange={(e) => setDisputeForm((f) => ({ ...f, evidenceUri: e.target.value }))}
                      placeholder="https:// or ipfs://"
                      className="w-full bg-token-subtle border border-token-border rounded-lg px-3 py-2.5 text-xs font-mono text-token-text outline-none focus:border-[#00C805]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-token-dim block mb-1.5">
                      Incident Summary
                    </label>
                    <textarea
                      value={disputeForm.reason}
                      onChange={(e) => setDisputeForm((f) => ({ ...f, reason: e.target.value }))}
                      placeholder="Specify failure, timestamps, and harm caused. Minimum 20 characters."
                      rows={4}
                      className="w-full bg-token-subtle border border-token-border rounded-lg px-3 py-2.5 text-xs text-token-text outline-none focus:border-[#00C805] resize-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={filing}
                  className="w-full mt-5 py-3 bg-[#00C805] hover:bg-[#00B004] text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {filing ? <Loader2 size={14} className="animate-spin text-black" /> : <Gavel size={14} />}
                  File Incident Report
                </button>
              </form>

              {/* User Incident Reports History */}
              {authenticated && reports.length > 0 && (
                <div className="robin-card p-5 bg-token-surface border border-token-border">
                  <h3 className="text-xs font-mono uppercase font-bold text-token-dim mb-3">
                    Your Submissions
                  </h3>
                  <div className="space-y-2">
                    {reports.slice(0, 4).map((report) => (
                      <div key={report.id} className="p-3 bg-token-subtle rounded-lg border border-token-border text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-token-text">{report.toolId}</span>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-token-surface border border-token-border text-token-dim">
                            {report.status}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-token-dim truncate mt-1">{report.providerAddress}</p>
                        {report.disputeId && (
                          <div className="mt-2 text-[10px] font-mono text-[#00C805] flex items-center gap-1">
                            <ChevronRight size={10} /> Escalated to Active Dispute
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Active DAO Slashing Cases */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase tracking-tight text-token-text flex items-center gap-2">
                  <Scale size={20} className="text-[#00C805]" />
                  Active Dispute Docket
                </h2>
                <span className="text-xs font-mono text-token-dim">
                  {disputes.length} {disputes.length === 1 ? "case" : "cases"} pending
                </span>
              </div>

              {loading ? (
                <div className="robin-card p-16 text-center bg-token-surface border border-token-border">
                  <Loader2 className="animate-spin mx-auto text-[#00C805] mb-3" size={24} />
                  <p className="text-xs font-mono text-token-dim">Loading court docket...</p>
                </div>
              ) : disputes.length === 0 ? (
                <div className="robin-card p-16 text-center bg-token-surface border border-token-border">
                  <CheckCircle className="mx-auto text-[#00C805] mb-4" size={36} />
                  <h3 className="font-bold text-lg text-token-text">All Providers In Compliance</h3>
                  <p className="text-xs text-token-dim mt-2 max-w-sm mx-auto">
                    Zero active slashing disputes. All node runners and tool providers maintain good standing.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {disputes.map((dispute) => {
                    const totalWeight =
                      (dispute.votesForSlash || 0) + (dispute.votesAgainstSlash || 0);
                    const slashPct =
                      totalWeight > 0 ? ((dispute.votesForSlash || 0) / totalWeight) * 100 : 0;
                    const dismissPct =
                      totalWeight > 0 ? ((dispute.votesAgainstSlash || 0) / totalWeight) * 100 : 0;
                    const now = Date.now();
                    const votingStartsAt = dispute.votingStartsAt
                      ? new Date(dispute.votingStartsAt).getTime()
                      : now;
                    const votingOpen =
                      now >= votingStartsAt && now < new Date(dispute.deadline).getTime();
                    const hoursLeft = Math.max(
                      0,
                      Math.ceil((new Date(dispute.deadline).getTime() - now) / (1000 * 60 * 60))
                    );
                    const thresholdPct = ((dispute.slashThresholdBps || 6000) / 100).toFixed(0);

                    return (
                      <article
                        key={dispute.id}
                        className="robin-card p-6 bg-token-surface border border-token-border space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div>
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-mono uppercase tracking-wider font-bold">
                              <ShieldAlert size={12} />
                              {(dispute.stakedAmount || 0).toLocaleString()} HIVE Collateral At Risk
                            </div>
                            <h3 className="font-bold text-lg text-token-text mt-2">
                              Tool Subject: {dispute.toolId}
                            </h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] font-mono text-token-dim">
                              <span>Phase: {dispute.phase || "voting"}</span>
                              <span>Slash Threshold: {thresholdPct}%</span>
                              <span>Quorum: {(dispute.quorumRequired || 0).toLocaleString()} HIVE</span>
                            </div>
                            <p className="text-[11px] font-mono text-token-dim mt-1 truncate max-w-md">
                              Provider: {dispute.providerAddress}
                            </p>
                          </div>

                          <div className="sm:text-right">
                            <span className="text-[10px] font-mono uppercase text-token-dim block">
                              {votingOpen ? "Voting Closes In" : "Voting Scheduled In"}
                            </span>
                            <span className="text-base font-mono font-black text-amber-500">
                              {hoursLeft} Hours
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-token-dim leading-relaxed bg-token-subtle p-3 rounded-lg border border-token-border">
                          {dispute.reason}
                        </p>

                        {dispute.evidenceUri && (
                          <a
                            href={dispute.evidenceUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00C805] hover:underline"
                          >
                            <span>Inspect Cryptographic Evidence</span>
                            <ExternalLink size={11} />
                          </a>
                        )}

                        {/* Staking Vote Split Bar */}
                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between text-[11px] font-mono text-token-dim">
                            <span className="text-red-500 font-bold">
                              Slash: {(dispute.votesForSlash || 0).toLocaleString()} HIVE ({slashPct.toFixed(1)}%)
                            </span>
                            <span className="text-[#00C805] font-bold">
                              Dismiss: {(dispute.votesAgainstSlash || 0).toLocaleString()} HIVE ({dismissPct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-token-subtle border border-token-border overflow-hidden flex">
                            <div className="bg-red-500 transition-all duration-500" style={{ width: `${slashPct}%` }} />
                            <div className="bg-[#00C805] transition-all duration-500" style={{ width: `${dismissPct}%` }} />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {votingOpen && (
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                              onClick={() => vote(dispute.id, "slash")}
                              disabled={votingId === dispute.id}
                              className="py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                              {votingId === dispute.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                              Vote to Slash
                            </button>
                            <button
                              onClick={() => vote(dispute.id, "dismiss")}
                              disabled={votingId === dispute.id}
                              className="py-2.5 rounded-xl border border-[#00C805]/30 bg-[#00C805]/10 hover:bg-[#00C805]/20 text-[#00C805] font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                              {votingId === dispute.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                              Vote to Dismiss
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
