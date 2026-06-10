"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle, ExternalLink, FilePlus, Loader2, RefreshCw, Wallet, XCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
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
      const solanaWallet = (window as any).solana
        || (window as any).phantom?.solana
        || (window as any).solflare
        || (window as any).backpack?.solana;

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

      toast.success(`Vote submitted: ${choice}`);
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
      toast.success("Report submitted for DAO review.");
      setDisputeForm({ providerAddress: "", toolId: "", category: "failed_execution", evidenceUri: "", reason: "", sessionLedgerId: "" });
      load();
    } catch (error: any) {
      toast.error(error.message || "Report could not be submitted.");
    } finally {
      setFiling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">DAO Disputes</h1>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-mono text-zinc-400">
                <span className="border border-white/10 bg-white/[0.03] rounded px-2 py-1">{disputes.length} active disputes</span>
                <span className="border border-white/10 bg-white/[0.03] rounded px-2 py-1">{reports.length} reports</span>
                <span className="border border-white/10 bg-white/[0.03] rounded px-2 py-1">Stake-weighted voting</span>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 rounded text-xs font-bold text-zinc-300 hover:text-white disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>

          {!authenticated && (
            <div className="mb-6 border border-amber-500/20 bg-amber-500/5 rounded-lg p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-amber-200">Sign in and connect a Solana wallet to vote.</p>
              <button onClick={() => login()} disabled={!ready} className="bg-white text-black px-4 py-2 rounded text-xs font-bold">
                Sign In
              </button>
            </div>
          )}

          {authenticated && !solanaAddress && (
            <div className="mb-6 border border-red-500/20 bg-red-500/5 rounded-lg p-4 flex items-center gap-3">
              <Wallet size={16} className="text-red-400" />
              <p className="text-sm text-red-200">No Solana wallet is linked. Link one from the dashboard before voting.</p>
            </div>
          )}

          <form onSubmit={fileDispute} className="mb-8 border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-bold">Submit Report</h2>
                <p className="text-xs text-zinc-500 mt-1">Reports are reviewed before becoming formal slashing votes.</p>
              </div>
              <FilePlus size={18} className="text-zinc-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={disputeForm.providerAddress}
                onChange={(event) => setDisputeForm((form) => ({ ...form, providerAddress: event.target.value }))}
                placeholder="Provider Solana address"
                className="bg-black/60 border border-white/10 rounded px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500/40"
              />
              <input
                value={disputeForm.toolId}
                onChange={(event) => setDisputeForm((form) => ({ ...form, toolId: event.target.value }))}
                placeholder="Tool ID or tool name"
                className="bg-black/60 border border-white/10 rounded px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500/40"
              />
              <select
                value={disputeForm.category}
                onChange={(event) => setDisputeForm((form) => ({ ...form, category: event.target.value }))}
                className="bg-black/60 border border-white/10 rounded px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500/40"
              >
                <option value="failed_execution">Failed execution</option>
                <option value="malicious_output">Malicious output</option>
                <option value="billing">Billing</option>
                <option value="uptime">Uptime</option>
                <option value="policy">Policy</option>
                <option value="other">Other</option>
              </select>
              <input
                value={disputeForm.sessionLedgerId}
                onChange={(event) => setDisputeForm((form) => ({ ...form, sessionLedgerId: event.target.value }))}
                placeholder="Session ledger ID (optional)"
                className="bg-black/60 border border-white/10 rounded px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500/40"
              />
              <input
                value={disputeForm.evidenceUri}
                onChange={(event) => setDisputeForm((form) => ({ ...form, evidenceUri: event.target.value }))}
                placeholder="Evidence URI: https://, ipfs://, or ar://"
                className="md:col-span-2 bg-black/60 border border-white/10 rounded px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500/40"
              />
              <textarea
                value={disputeForm.reason}
                onChange={(event) => setDisputeForm((form) => ({ ...form, reason: event.target.value }))}
                placeholder="Describe the failure, harm, and evidence. Minimum 20 characters."
                rows={4}
                className="md:col-span-2 bg-black/60 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-emerald-500/40 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={filing}
              className="mt-4 inline-flex items-center justify-center gap-2 bg-white text-black rounded px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              {filing ? <Loader2 size={14} className="animate-spin" /> : <FilePlus size={14} />}
              Submit Report
            </button>
          </form>

          {authenticated && reports.length > 0 && (
            <section className="mb-8 border border-white/10 bg-white/[0.02] rounded-lg p-5">
              <h2 className="font-bold mb-4">Your Reports</h2>
              <div className="space-y-3">
                {reports.slice(0, 5).map((report) => (
                  <div key={report.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-white/10 bg-black/30 rounded p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Tool: {report.toolId}</span>
                        <span className="text-[10px] font-mono uppercase border border-white/10 rounded px-2 py-0.5 text-zinc-400">{report.status}</span>
                      </div>
                      <p className="text-[11px] font-mono text-zinc-500 truncate mt-1">{report.providerAddress}</p>
                      {report.triageReason && <p className="text-xs text-amber-300 mt-2">{report.triageReason}</p>}
                    </div>
                    {report.disputeId && (
                      <span className="text-[11px] font-mono text-emerald-400">Escalated: {report.disputeId.slice(0, 8)}...</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {loading ? (
            <div className="border border-white/10 bg-white/[0.03] rounded-lg p-10 text-center">
              <Loader2 className="animate-spin mx-auto text-emerald-400" size={24} />
            </div>
          ) : disputes.length === 0 ? (
            <div className="border border-white/10 bg-white/[0.03] rounded-lg p-10 text-center">
              <CheckCircle className="mx-auto text-emerald-400 mb-4" size={28} />
              <h2 className="font-bold">No Active Disputes</h2>
              <p className="text-sm text-zinc-500 mt-2">There are no open slashing votes right now.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {disputes.map((dispute) => {
                const totalWeight = (dispute.votesForSlash || 0) + (dispute.votesAgainstSlash || 0);
                const slashPct = totalWeight > 0 ? ((dispute.votesForSlash || 0) / totalWeight) * 100 : 0;
                const dismissPct = totalWeight > 0 ? ((dispute.votesAgainstSlash || 0) / totalWeight) * 100 : 0;
                const now = Date.now();
                const votingStartsAt = dispute.votingStartsAt ? new Date(dispute.votingStartsAt).getTime() : now;
                const votingOpen = now >= votingStartsAt && now < new Date(dispute.deadline).getTime();
                const hoursLeft = Math.max(0, Math.ceil((new Date(dispute.deadline).getTime() - now) / (1000 * 60 * 60)));
                const evidenceHoursLeft = dispute.evidenceOpenUntil
                  ? Math.max(0, Math.ceil((new Date(dispute.evidenceOpenUntil).getTime() - now) / (1000 * 60 * 60)))
                  : 0;
                const thresholdPct = ((dispute.slashThresholdBps || 6000) / 100).toFixed(0);

                return (
                  <article key={dispute.id} className="border border-white/10 bg-[#0A0A0A] rounded-lg p-5">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                          <AlertTriangle size={12} /> {dispute.stakedAmount?.toLocaleString?.() || 0} HIVE at risk
                        </div>
                        <h2 className="font-bold text-lg mt-3">Tool: {dispute.toolId}</h2>
                        <p className="text-[11px] text-zinc-400 font-mono mt-1 uppercase">Phase: {dispute.phase || "voting"} • Slash threshold: {thresholdPct}% • Quorum: {(dispute.quorumRequired || 0).toLocaleString()} HIVE</p>
                        <p className="text-[11px] text-zinc-500 font-mono truncate max-w-xl mt-1">Provider: {dispute.providerAddress}</p>
                        <p className="text-[11px] text-zinc-600 font-mono mt-1">Snapshot slot: {dispute.snapshotBlock}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">{votingOpen ? "Voting closes in" : "Voting starts in"}</div>
                        <div className="text-amber-400 font-mono font-bold">{votingOpen ? hoursLeft : evidenceHoursLeft}h</div>
                      </div>
                    </div>

                    <p className="text-sm text-zinc-400 mt-4 leading-relaxed">{dispute.reason}</p>

                    {dispute.evidenceUri && (
                      <a
                        href={dispute.evidenceUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 mt-4"
                      >
                        View evidence <ExternalLink size={12} />
                      </a>
                    )}

                    <div className="mt-5">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-500 mb-2">
                        <span>Slash: {(dispute.votesForSlash || 0).toLocaleString()} HIVE ({slashPct.toFixed(1)}%)</span>
                        <span>Dismiss: {(dispute.votesAgainstSlash || 0).toLocaleString()} HIVE ({dismissPct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-900 rounded overflow-hidden flex">
                        <div className="bg-red-500" style={{ width: `${slashPct}%` }} />
                        <div className="bg-emerald-500" style={{ width: `${dismissPct}%` }} />
                      </div>
                    </div>

                    {!votingOpen && (
                      <div className="mt-5 border border-amber-500/20 bg-amber-500/5 rounded p-3 text-xs text-amber-200">
                        Evidence period is open. Voting starts after evidence closes.
                      </div>
                    )}

                    {votingOpen && (
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => vote(dispute.id, "slash")}
                        disabled={votingId === dispute.id}
                        className="inline-flex items-center justify-center gap-2 bg-red-600/90 hover:bg-red-500 text-white rounded px-4 py-2 text-xs font-bold disabled:opacity-50"
                      >
                        {votingId === dispute.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                        Vote Slash
                      </button>
                      <button
                        onClick={() => vote(dispute.id, "dismiss")}
                        disabled={votingId === dispute.id}
                        className="inline-flex items-center justify-center gap-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded px-4 py-2 text-xs font-bold disabled:opacity-50"
                      >
                        {votingId === dispute.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Vote Dismiss
                      </button>
                    </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
