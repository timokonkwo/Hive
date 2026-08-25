"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useModalStatus } from "@privy-io/react-auth";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import { FileText } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { BnbContainer, BnbPanel } from "@/app/bnb/_components/BnbUi";
import { BnbDeliveryView } from "@/app/bnb/_components/BnbDeliveryView";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import { getClientBnbChainId, getClientBnbNativeSymbol } from "@/lib/bnb/client-chain";
import { bnbRefundUnavailableReason } from "@/lib/bnb/settlement-state";
import type { BnbAccessRequestRecord, BnbActivationRecord, BnbRecordsSnapshot } from "@/lib/bnb/types";

type ActivityRow = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  href?: string;
};

export function ReceiptsClient({ embedded = false }: { embedded?: boolean } = {}) {
  const { authenticated, login, ready, connectWallet } = useAuth();
  const { address, chainId } = useAccount();
  const { isOpen: privyModalOpen } = useModalStatus();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { authFetch } = useBnbAuthFetch();
  const targetChainId = getClientBnbChainId();
  const nativeSymbol = getClientBnbNativeSymbol();
  const [records, setRecords] = useState<BnbRecordsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!privyModalOpen) {
      setAuthBusy(false);
      setWalletBusy(false);
    }
  }, [privyModalOpen]);

  useEffect(() => {
    if ((!ready && !address) || (!authenticated && !address)) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    authFetch("/api/bnb/records?limit=25")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(response.status === 401 ? "We could not load your activity. Try again." : payload.error || "Could not load activity.");
        }
        if (!cancelled) setRecords(payload);
      })
      .catch((activityError) => {
        if (!cancelled) setError(activityError instanceof Error ? activityError.message : "Could not load activity.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, authenticated, authFetch, ready, reloadKey]);

  const rows = useMemo(() => {
    if (!records) return [];

    const hires: ActivityRow[] = records.activations.map((record) => ({
      id: record.recordId,
      title: record.agent.name,
      detail: record.limits.task,
      meta: jobStatusLabel(record),
      href: `/bnb/jobs/${encodeURIComponent(record.recordId)}`,
    }));

    const accessRequests: ActivityRow[] = records.accessRequests.map((record) => ({
      id: record.recordId,
      title: record.agent.name,
      detail: record.task,
      meta: accessRequestStatus(record),
      href: `/bnb/agents/${record.agent.chainId}/${encodeURIComponent(record.agent.tokenId)}`,
    }));

    const comparisons: ActivityRow[] = records.termixComparisons.map((record) => ({
      id: record.recordId,
      title: record.title,
      detail: `${record.target} / ${record.manualTime || "manual time"} vs ${record.agentTime || "agent time"}`,
      meta: record.qualityScore ? `${record.verdict} / ${record.qualityScore}` : record.verdict,
      href: "/bnb/termix",
    }));

    const alerts: ActivityRow[] = records.altanaSessions.map((record) => ({
      id: record.recordId,
      title: record.title,
      detail: record.walletAddress ? `${record.walletLabel} / ${record.walletAddress}` : record.walletLabel,
      meta: record.status === "stopped" ? "Stopped" : "Active",
      href: "/bnb/altana",
    }));

    return [...hires, ...accessRequests, ...comparisons, ...alerts];
  }, [records]);

  function replaceActivation(record: BnbActivationRecord) {
    setRecords((current) => {
      if (!current) return current;
      return {
        ...current,
        activations: current.activations.map((item) => item.recordId === record.recordId ? record : item),
      };
    });
  }

  function replaceAccessRequest(record: BnbAccessRequestRecord) {
    setRecords((current) => {
      if (!current) return current;
      return {
        ...current,
        accessRequests: current.accessRequests.map((item) => item.recordId === record.recordId ? record : item),
      };
    });
  }

  function signInWithBnbWallet() {
    setAuthBusy(true);
    login({
      loginMethods: ["wallet"],
      walletChainType: "ethereum-only",
    });
  }

  async function cancelAccessRequest(record: BnbAccessRequestRecord) {
    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;
    setActionId(`${record.recordId}:cancel`);
    setError("");

    try {
      const response = await authFetch("/api/bnb/access-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId, cancelReason: "Cancelled from activity" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not cancel access request.");
      if (payload.record) replaceAccessRequest(payload.record);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel access request.");
    } finally {
      setActionId("");
    }
  }

  async function runHire(record: BnbActivationRecord) {
    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;
    setActionId(`${record.recordId}:run`);
    setError("");

    try {
      const response = await authFetch("/api/bnb/activate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.record) replaceActivation(payload.record);
        throw new Error(payload.error || "Agent work failed.");
      }
      if (payload.record) replaceActivation(payload.record);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Agent work failed.");
    } finally {
      setActionId("");
    }
  }

  async function settleHire(record: BnbActivationRecord, action: "release" | "refund") {
    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;
    if (!address) {
      setWalletBusy(true);
      connectWallet({
        walletChainType: "ethereum-only",
        description: `Connect the wallet you want to use for ${nativeSymbol} transactions.`,
      });
      return;
    }

    setActionId(`${record.recordId}:${action}`);
    setError("");

    try {
      if (chainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }

      const prepareResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId, action }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare escrow transaction.");
      const settlementRequest = prepared.settlementRequest;
      if (settlementRequest.status !== "ready") throw new Error(settlementRequest.reason);

      const hash = await sendTransactionAsync({
        to: settlementRequest.to as Hex,
        data: settlementRequest.data as Hex,
        value: BigInt(settlementRequest.value),
        gas: settlementRequest.gasLimit ? BigInt(settlementRequest.gasLimit) : undefined,
        chainId: targetChainId,
      });

      const confirmResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId, action, transactionHash: hash }),
      });
      const payload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(payload.error || "Escrow transaction was sent, but the record could not be updated.");
      if (payload.record) replaceActivation(payload.record);
    } catch (settlementError) {
      setError(settlementError instanceof Error ? settlementError.message : "Could not update escrow.");
    } finally {
      setActionId("");
    }
  }

  if (!ready && !address) {
    return (
      <ActivityFrame embedded={embedded}>
        <BnbPanel className="p-6">
          <BnbButtonLoader size={20} />
        </BnbPanel>
      </ActivityFrame>
    );
  }

  if (!authenticated && !address) {
    if (embedded) return null;

    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="p-6">
          <h2 className="text-xl font-semibold text-white">Sign in to view activity</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Your hires, requests, alerts, and payments are private to your Hive account.</p>
          <button type="button" onClick={signInWithBnbWallet} disabled={authBusy || privyModalOpen} aria-busy={authBusy || privyModalOpen} className="bnb-button bnb-focus mt-5">
            {authBusy || privyModalOpen ? <BnbButtonLoader /> : null}
            {authBusy || privyModalOpen ? "Opening wallet..." : "Sign in"}
          </button>
        </BnbPanel>
      </BnbContainer>
    );
  }

  return (
    <ActivityFrame embedded={embedded}>
      {error ? (
        <div className="bnb-error mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span>{error}</span>
          <button type="button" className="bnb-link-button bnb-focus" onClick={() => setReloadKey((current) => current + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="bnb-list-panel">
        <div className="bnb-list-head">
          <div>
            <h2>Activity</h2>
            <p>Hires, wallet alerts, comparisons, and payment updates.</p>
          </div>
          <Link href="/bnb/agents" className="bnb-text-action bnb-focus">Browse agents</Link>
        </div>

        <BnbPanel className="overflow-hidden">
          {loading ? (
            <div className="grid gap-0">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bnb-receipt-row">
                  <div className="h-4 w-40 rounded bg-zinc-800" />
                  <div className="mt-3 h-3 w-64 rounded bg-zinc-900" />
                </div>
              ))}
            </div>
          ) : rows.length > 0 ? (
            <div>
              {records?.activations.map((record) => {
                const paymentNotRequired = record.limits.walletConfirmationRequired === false;
                const funded = paymentNotRequired || record.payment?.transactionStatus === "success";
                const completed = record.delivery?.status === "delivered" || record.work?.status === "completed" || record.status === "delivered" || record.status === "work_completed";
                const closed = record.status === "paid" || record.status === "released" || record.status === "refunded";
                const running = record.delivery?.status === "running" || record.work?.status === "running" || record.status === "running";
                const failed = record.delivery?.status === "failed" || record.work?.status === "failed" || record.status === "failed";
                const output = record.delivery?.rawOutput || record.work?.output;
                const dataSources = record.delivery?.dataSources || record.work?.dataSources;
                const refundBlocker = bnbRefundUnavailableReason(record);
                const showSettlementActions = !paymentNotRequired && completed && !closed;
                return (
                  <article key={record.recordId} className="bnb-receipt-row">
                    <span>
                      <Link href={`/bnb/jobs/${encodeURIComponent(record.recordId)}`} className="flex items-center gap-2 text-sm font-semibold text-white bnb-focus">
                        <FileText aria-hidden="true" size={15} />
                        {record.agent.name}
                      </Link>
                      <span className="mt-1 block break-all text-sm leading-6 text-zinc-500">{record.limits.task}</span>
                      {output ? (
                        <BnbDeliveryView output={output} jobSpec={record.jobSpec} dataSources={dataSources} compact className="mt-3" />
                      ) : null}
                    </span>
                    <span className="grid gap-2 justify-items-start sm:justify-items-end">
                      <span className="bnb-chip">{jobStatusLabel(record)}</span>
                      <Link href={`/bnb/jobs/${encodeURIComponent(record.recordId)}`} className="bnb-button-dark bnb-focus">
                        View
                      </Link>
                      {funded && !completed && !closed && !failed ? (
                        <button
                          type="button"
                          onClick={() => runHire(record)}
                          disabled={Boolean(actionId) || running}
                          aria-busy={actionId === `${record.recordId}:run` || running}
                          className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionId === `${record.recordId}:run` ? <BnbButtonLoader /> : null}
                          {actionId === `${record.recordId}:run` || running ? "Running..." : "Run agent"}
                        </button>
                      ) : null}
                      {showSettlementActions ? (
                        <span className="grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => settleHire(record, "release")}
                            disabled={Boolean(actionId) || walletBusy}
                            aria-busy={actionId === `${record.recordId}:release` || walletBusy}
                            className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionId === `${record.recordId}:release` || walletBusy ? <BnbButtonLoader /> : null}
                            {walletBusy ? "Opening wallet..." : actionId === `${record.recordId}:release` ? "Confirming..." : "Release"}
                          </button>
                          {!refundBlocker ? (
                            <button
                              type="button"
                              onClick={() => settleHire(record, "refund")}
                              disabled={Boolean(actionId) || walletBusy}
                              aria-busy={actionId === `${record.recordId}:refund` || walletBusy}
                              className="bnb-button bnb-button-secondary bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {actionId === `${record.recordId}:refund` || walletBusy ? <BnbButtonLoader /> : null}
                              {walletBusy ? "Opening wallet..." : actionId === `${record.recordId}:refund` ? "Confirming..." : "Refund"}
                            </button>
                          ) : (
                            <p className="bnb-field-hint bnb-action-hint">{refundBlocker}</p>
                          )}
                        </span>
                      ) : null}
                    </span>
                  </article>
                );
              })}
              {records?.accessRequests.map((record) => (
                <article key={record.recordId} className="bnb-receipt-row">
                  <span>
                    <Link href={`/bnb/agents/${record.agent.chainId}/${encodeURIComponent(record.agent.tokenId)}`} className="flex items-center gap-2 text-sm font-semibold text-white bnb-focus">
                      <FileText aria-hidden="true" size={15} />
                      {record.agent.name}
                    </Link>
                    <span className="mt-1 block break-all text-sm leading-6 text-zinc-500">{record.task}</span>
                    {(record.budget || record.deadline) ? (
                      <span className="mt-2 block text-xs leading-5 text-zinc-500">
                        {[record.budget, record.deadline].filter(Boolean).join(" / ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="grid gap-2 justify-items-start sm:justify-items-end">
                    <span className="bnb-chip">{accessRequestStatus(record)}</span>
                    {record.status === "requested" ? (
                      <button
                        type="button"
                        onClick={() => cancelAccessRequest(record)}
                        disabled={Boolean(actionId)}
                        aria-busy={actionId === `${record.recordId}:cancel`}
                        className="bnb-link-button bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionId === `${record.recordId}:cancel` ? <BnbButtonLoader /> : null}
                        {actionId === `${record.recordId}:cancel` ? "Cancelling..." : "Cancel request"}
                      </button>
                    ) : null}
                  </span>
                </article>
              ))}
              {rows.filter((row) => {
                const isHire = records?.activations.some((record) => record.recordId === row.id);
                const isAccessRequest = records?.accessRequests.some((record) => record.recordId === row.id);
                return !isHire && !isAccessRequest;
              }).map((row) => (
                <Link key={row.id} href={row.href || "/bnb/account#activity"} className="bnb-receipt-row bnb-focus">
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">
                      <FileText aria-hidden="true" size={15} />
                      {row.title}
                    </span>
                    <span className="mt-1 block break-all text-sm leading-6 text-zinc-500">{row.detail}</span>
                  </span>
                  <span className="bnb-chip">{row.meta}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white">No activity yet</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Hire an agent or save a wallet alert to create your first record.</p>
              <Link href="/bnb/agents" className="bnb-button bnb-focus mt-5">
                Browse agents
              </Link>
            </div>
          )}
        </BnbPanel>
      </section>
    </ActivityFrame>
  );
}

function ActivityFrame({ embedded, children }: { embedded?: boolean; children: ReactNode }) {
  if (embedded) {
    return (
      <div id="activity" className="bnb-container bnb-account-activity">
        {children}
      </div>
    );
  }

  return <BnbContainer className="bnb-section">{children}</BnbContainer>;
}

function accessRequestStatus(record: BnbAccessRequestRecord) {
  if (record.status === "cancelled") return "Cancelled";
  if (record.status === "converted_to_hire") return "Converted to hire";
  return "Access requested";
}

function jobStatusLabel(record: BnbActivationRecord) {
  if (record.status === "paid" || record.status === "released") return "Paid";
  if (record.status === "refunded") return "Refunded";
  if (record.delivery?.status === "delivered" || record.work?.status === "completed" || record.status === "delivered" || record.status === "work_completed") return "Delivered";
  if (record.delivery?.status === "running" || record.work?.status === "running" || record.status === "running") return "Running";
  if (record.payment?.transactionStatus === "success" || record.status === "funded" || record.status === "payment_confirmed") return "Funded";
  if (record.status === "payment_submitted") return "Payment submitted";
  if (record.status === "failed") return "Failed";
  if (record.limits.walletConfirmationRequired === false) return "Run";
  return "Awaiting funding";
}

function ensureProtectedSession({
  authenticated,
  walletAddress,
  login,
}: {
  authenticated: boolean;
  walletAddress?: string;
  login: () => void;
}) {
  if (!authenticated && !walletAddress) {
    login();
    return false;
  }

  return true;
}
