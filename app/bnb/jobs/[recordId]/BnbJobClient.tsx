"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useModalStatus } from "@privy-io/react-auth";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import { ArrowLeft, CreditCard, Play } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { BnbContainer, BnbPanel } from "@/app/bnb/_components/BnbUi";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import { getClientBnbChainId, getClientBnbExplorerAddressUrl, getClientBnbExplorerTxUrl, getClientBnbNativeSymbol } from "@/lib/bnb/client-chain";
import { formatBnbDeliveryText } from "@/lib/bnb/delivery";
import { bnbRefundUnavailableReason } from "@/lib/bnb/settlement-state";
import type { BnbActivationRecord } from "@/lib/bnb/types";

type PaymentRequest =
  | {
      status: "ready";
      chainId: number;
      to: string;
      value: string;
      data: string;
      gasLimit?: string;
      amountLabel: string;
    }
  | {
      status: "setup_required" | "budget_needs_bnb" | "agent_wallet_invalid" | "not_required";
      reason: string;
    };

type SettlementRequest =
  | {
      status: "ready";
      chainId: number;
      to: string;
      value: string;
      data: string;
      gasLimit?: string;
      action: "release" | "refund";
    }
  | {
      status: "setup_required" | "not_ready";
      reason: string;
    };

type JobPayload = {
  record: BnbActivationRecord;
  paymentRequest?: PaymentRequest | null;
};

export function BnbJobClient({ recordId }: { recordId: string }) {
  const { authenticated, login, ready, connectWallet } = useAuth();
  const { address, chainId } = useAccount();
  const { isOpen: privyModalOpen } = useModalStatus();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { authFetch } = useBnbAuthFetch();
  const targetChainId = getClientBnbChainId();
  const nativeSymbol = getClientBnbNativeSymbol();
  const [job, setJob] = useState<JobPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [authAction, setAuthAction] = useState<"login" | "connect" | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!privyModalOpen) {
      setAuthAction("");
    }
  }, [privyModalOpen]);

  useEffect(() => {
    if (!ready && !address) return;
    if (!authenticated && !address) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    authFetch(`/api/bnb/jobs/${encodeURIComponent(recordId)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load job.");
        if (!cancelled) setJob(payload);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load job.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, authFetch, authenticated, ready, recordId]);

  async function ensureWallet() {
    if (!authenticated && !address) {
      signInWithBnbWallet();
      return false;
    }
    if (!address) {
      setAuthAction("connect");
      connectWallet({
        walletChainType: "ethereum-only",
        description: `Connect the wallet you want to use for ${nativeSymbol} transactions.`,
      });
      return false;
    }
    if (chainId !== targetChainId) {
      await switchChainAsync({ chainId: targetChainId });
    }
    return true;
  }

  function signInWithBnbWallet() {
    setAuthAction("login");
    login({
      loginMethods: ["wallet"],
      walletChainType: "ethereum-only",
    });
  }

  async function fundJob() {
    if (!job?.paymentRequest || job.paymentRequest.status !== "ready") return;
    setAction("fund");
    setError("");

    try {
      if (!(await ensureWallet())) return;
      const hash = await sendTransactionAsync({
        to: job.paymentRequest.to as Hex,
        data: job.paymentRequest.data as Hex,
        value: BigInt(job.paymentRequest.value),
        gas: job.paymentRequest.gasLimit ? BigInt(job.paymentRequest.gasLimit) : undefined,
        chainId: targetChainId,
      });
      const response = await authFetch("/api/bnb/activate/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, transactionHash: hash }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Payment was sent, but the job could not be updated.");
      setJob({ record: payload.record, paymentRequest: null });
    } catch (fundError) {
      setError(fundError instanceof Error ? fundError.message : "Could not fund job.");
    } finally {
      setAction("");
    }
  }

  async function runJob() {
    setAction("run");
    setError("");

    try {
      const response = await authFetch("/api/bnb/activate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Agent run failed.");
      setJob((current) => current ? { ...current, record: payload.record } : current);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Agent run failed.");
    } finally {
      setAction("");
    }
  }

  async function settleJob(settlementAction: "release" | "refund") {
    setAction(settlementAction);
    setError("");

    try {
      if (!(await ensureWallet())) return;
      const prepareResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, action: settlementAction }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare payment transaction.");
      const settlementRequest = prepared.settlementRequest as SettlementRequest;
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
        body: JSON.stringify({ recordId, action: settlementAction, transactionHash: hash }),
      });
      const payload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(payload.error || "Transaction was sent, but the job could not be updated.");
      setJob((current) => current ? { ...current, record: payload.record } : current);
    } catch (settleError) {
      setError(settleError instanceof Error ? settleError.message : "Could not update payment.");
    } finally {
      setAction("");
    }
  }

  if ((!ready && !address) || loading) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="p-6">
          <BnbButtonLoader size={20} />
        </BnbPanel>
      </BnbContainer>
    );
  }

  if (!authenticated && !address) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="bnb-job-empty">
          <h2>Sign in to view this job</h2>
          <button
            type="button"
            className="bnb-button bnb-focus"
            onClick={signInWithBnbWallet}
            disabled={authAction === "login" || privyModalOpen}
            aria-busy={authAction === "login" || privyModalOpen}
          >
            {authAction === "login" || privyModalOpen ? <BnbButtonLoader /> : null}
            {authAction === "login" || privyModalOpen ? "Opening wallet..." : "Sign in"}
          </button>
        </BnbPanel>
      </BnbContainer>
    );
  }

  if (!job) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="bnb-job-empty">
          <h2>Job unavailable</h2>
          <p>{error || "This job could not be loaded."}</p>
          <Link href="/bnb/account" className="bnb-button-dark bnb-focus">Back to account</Link>
        </BnbPanel>
      </BnbContainer>
    );
  }

  const record = job.record;
  const paymentNotRequired = job.paymentRequest?.status === "not_required" || record.limits.walletConfirmationRequired === false;
  const delivered = record.delivery?.status === "delivered" || record.work?.status === "completed" || record.status === "delivered" || record.status === "work_completed";
  const funded = paymentNotRequired || record.payment?.transactionStatus === "success" || record.status === "funded" || record.status === "payment_confirmed" || delivered;
  const closed = record.status === "paid" || record.status === "released" || record.status === "refunded";
  const running = record.delivery?.status === "running" || record.work?.status === "running" || record.status === "running";
  const output = record.delivery?.rawOutput || record.work?.output;
  const deliveryText = formatBnbDeliveryText(output, record.jobSpec);
  const refundBlocker = bnbRefundUnavailableReason(record);
  const showSettlementActions = !paymentNotRequired && delivered && !closed;
  const fundedExplorerUrl = record.payment?.explorerUrl || (record.payment?.transactionHash ? getClientBnbExplorerTxUrl(record.payment.transactionHash) : "");
  const settlementExplorerUrl = record.settlement?.explorerUrl || (record.settlement?.transactionHash ? getClientBnbExplorerTxUrl(record.settlement.transactionHash) : "");

  return (
    <BnbContainer className="bnb-section">
      <Link href="/bnb/account#activity" className="bnb-agent-back bnb-focus">
        <ArrowLeft aria-hidden="true" size={15} />
        My hires
      </Link>

      <div className="bnb-job-layout">
        <main className="bnb-job-main">
          <BnbPanel className="bnb-job-panel">
            <div className="bnb-job-title-row">
              <div>
                <span className="bnb-eyebrow">{jobStatusLabel(record)}</span>
                <h2>{record.agent.name}</h2>
              </div>
              {!paymentNotRequired ? <span className="bnb-chip bnb-chip-active">{record.limits.budget}</span> : null}
            </div>

            {record.jobSpec ? (
              <div className="bnb-job-section">
                <h3>{record.jobSpec.taskType}</h3>
                <pre>{record.jobSpec.summary}</pre>
              </div>
            ) : (
              <div className="bnb-job-section">
                <h3>Work</h3>
                <pre>{record.limits.task}</pre>
              </div>
            )}

            <div className="bnb-job-section">
              <h3>Delivery</h3>
              {output ? <pre>{deliveryText}</pre> : <p>No delivery yet.</p>}
              {record.delivery?.error || record.work?.error ? <p className="bnb-form-error">{record.delivery?.error || record.work?.error}</p> : null}
            </div>
          </BnbPanel>
        </main>

        <aside className="bnb-job-side">
          <BnbPanel className="bnb-job-panel">
            <h2>Next action</h2>
            <p>{nextActionCopy(record)}</p>
            <div className="bnb-job-actions">
              {job.paymentRequest?.status === "ready" && !funded ? (
                <button type="button" className="bnb-button bnb-focus" onClick={fundJob} disabled={Boolean(action)} aria-busy={action === "fund"}>
                  {action === "fund" ? <BnbButtonLoader /> : <CreditCard aria-hidden="true" size={16} />}
                  {action === "fund" ? "Confirming..." : `Fund ${job.paymentRequest.amountLabel}`}
                </button>
              ) : null}
              {funded && !delivered && !closed ? (
                <button type="button" className="bnb-button bnb-focus" onClick={runJob} disabled={Boolean(action) || running} aria-busy={action === "run" || running}>
                  {action === "run" || running ? <BnbButtonLoader /> : <Play aria-hidden="true" size={16} />}
                  {action === "run" || running ? "Running..." : "Run agent"}
                </button>
              ) : null}
              {showSettlementActions ? (
                <>
                  <button type="button" className="bnb-button bnb-focus" onClick={() => settleJob("release")} disabled={Boolean(action)} aria-busy={action === "release"}>
                    {action === "release" ? <BnbButtonLoader /> : null}
                    {action === "release" ? "Confirming..." : "Release payment"}
                  </button>
                  {!refundBlocker ? (
                    <button type="button" className="bnb-button-dark bnb-focus" onClick={() => settleJob("refund")} disabled={Boolean(action)} aria-busy={action === "refund"}>
                      {action === "refund" ? <BnbButtonLoader /> : null}
                      {action === "refund" ? "Confirming..." : "Refund after expiry"}
                    </button>
                  ) : (
                    <p className="bnb-field-hint bnb-action-hint">{refundBlocker}</p>
                  )}
                </>
              ) : null}
              <Link href={`/bnb/agents/${record.agent.chainId}/${encodeURIComponent(record.agent.tokenId)}`} className="bnb-button-dark bnb-focus">
                View agent
              </Link>
            </div>
            {job.paymentRequest && job.paymentRequest.status !== "ready" && job.paymentRequest.status !== "not_required" ? <p className="bnb-form-error">{job.paymentRequest.reason}</p> : null}
            {error ? <p className="bnb-form-error">{error}</p> : null}
          </BnbPanel>

          <BnbPanel className="bnb-job-panel">
            <h2>{paymentNotRequired ? "Run details" : "Payment"}</h2>
            <dl>
              {!paymentNotRequired ? <DataRow label="Budget" value={record.limits.budget} /> : null}
              <DataRow label="Network" value={nativeSymbol} />
              <DataRow label="Expires" value={record.limits.expires} />
              {record.payment?.contractAddress ? (
                <DataRow
                  label="Escrow contract"
                  value={record.payment.contractAddress}
                  displayValue={shortHash(record.payment.contractAddress)}
                  href={getClientBnbExplorerAddressUrl(record.payment.contractAddress)}
                  copyValue={record.payment.contractAddress}
                />
              ) : null}
              {record.payment?.jobId ? <DataRow label="Escrow job" value={record.payment.jobId} displayValue={shortHash(record.payment.jobId)} copyValue={record.payment.jobId} /> : null}
              {record.payment?.transactionHash ? (
                <DataRow
                  label="Funded"
                  value={record.payment.transactionHash}
                  displayValue={shortHash(record.payment.transactionHash)}
                  href={fundedExplorerUrl}
                  copyValue={record.payment.transactionHash}
                />
              ) : null}
              {record.settlement?.transactionHash ? (
                <DataRow
                  label="Settlement"
                  value={record.settlement.transactionHash}
                  displayValue={shortHash(record.settlement.transactionHash)}
                  href={settlementExplorerUrl}
                  copyValue={record.settlement.transactionHash}
                />
              ) : null}
            </dl>
          </BnbPanel>
        </aside>
      </div>
    </BnbContainer>
  );
}

function DataRow({
  label,
  value,
  displayValue,
  href,
  copyValue,
}: {
  label: string;
  value: string;
  displayValue?: string;
  href?: string;
  copyValue?: string;
}) {
  const visibleValue = displayValue || value;

  return (
    <div className="bnb-data-row">
      <dt>{label}</dt>
      <dd className="bnb-data-value">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" title={value}>
            {visibleValue}
          </a>
        ) : (
          <span title={value}>{visibleValue}</span>
        )}
        {copyValue ? <CopyValueButton value={copyValue} label={label.toLowerCase()} /> : null}
      </dd>
    </div>
  );
}

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

function jobStatusLabel(record: BnbActivationRecord) {
  if (record.status === "paid" || record.status === "released") return "Paid";
  if (record.status === "refunded") return "Refunded";
  if (record.delivery?.status === "delivered" || record.work?.status === "completed" || record.status === "delivered" || record.status === "work_completed") return "Delivered";
  if (record.delivery?.status === "running" || record.work?.status === "running" || record.status === "running") return "Running";
  if (record.payment?.transactionStatus === "success" || record.status === "funded" || record.status === "payment_confirmed") return "Funded";
  if (record.status === "failed") return "Failed";
  if (record.limits.walletConfirmationRequired === false) return "Ready";
  return "Awaiting funding";
}

function nextActionCopy(record: BnbActivationRecord) {
  const label = jobStatusLabel(record);
  const paymentNotRequired = record.limits.walletConfirmationRequired === false;
  if (label === "Ready") return "Run the agent.";
  if (label === "Awaiting funding") return record.limits.walletConfirmationRequired ? "Fund the job to start." : "Run the agent.";
  if (label === "Funded") return "Run the agent.";
  if (label === "Running") return "The agent is working on this job.";
  if (label === "Delivered") return paymentNotRequired ? "Review the result." : "Review the delivery.";
  if (label === "Paid") return "Payment has been released.";
  if (label === "Refunded") return "Payment has been refunded.";
  return "Check the job state and retry if needed.";
}
