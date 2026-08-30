"use client";

import { useEffect, useState } from "react";
import { useModalStatus } from "@privy-io/react-auth";
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain, useWalletClient } from "wagmi";
import type { Hex } from "viem";
import { CheckCircle2, CreditCard, Play } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { BnbContainer } from "@/app/bnb/_components/BnbUi";
import { BnbPendingLink } from "@/app/bnb/_components/BnbPendingLink";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import { BnbDeliveryView } from "@/app/bnb/_components/BnbDeliveryView";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import { getClientBnbChainId, getClientBnbExplorerAddressUrl, getClientBnbExplorerTxUrl, getClientBnbNativeSymbol } from "@/lib/bnb/client-chain";
import { bnbJobTaskLabel, getBnbJobSpecDefinition } from "@/lib/bnb/jobs";
import { bnbRefundUnavailableReason } from "@/lib/bnb/settlement-state";
import type { BnbActivationRecord } from "@/lib/bnb/types";
import type { BnbPaymentRequest } from "@/lib/bnb/types";
import {
  bnbX402ChainId,
  bnbX402Signer,
  createBnbX402PaymentConfirmation,
  getBnbX402Permit2Approval,
} from "@/lib/bnb/client-x402";
import styles from "./job.module.css";

type PaymentRequest = BnbPaymentRequest;

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
  const targetChainId = getClientBnbChainId();
  const nativeSymbol = getClientBnbNativeSymbol();
  const { authenticated, login, ready, connectWallet } = useAuth();
  const { address, chainId } = useAccount();
  const { isOpen: privyModalOpen } = useModalStatus();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { data: walletClient } = useWalletClient();
  const { authFetch } = useBnbAuthFetch();
  const [job, setJob] = useState<JobPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [authAction, setAuthAction] = useState<"login" | "connect" | "">("");
  const [error, setError] = useState("");
  const activePaymentChainId = jobPaymentChainId(job?.paymentRequest, targetChainId);
  const publicClient = usePublicClient({ chainId: activePaymentChainId });

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

  async function ensureWallet(requiredChainId = targetChainId) {
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
    if (chainId !== requiredChainId) {
      await switchChainAsync({ chainId: requiredChainId });
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
      const requiredChainId = jobPaymentChainId(job.paymentRequest, targetChainId);
      if (!(await ensureWallet(requiredChainId))) return;
      let paymentConfirmation: { transactionHash?: string; paymentHeader?: string };
      if (job.paymentRequest.mode === "x402") {
        const paymentChainId = bnbX402ChainId(job.paymentRequest);
        if (!address || !walletClient || !publicClient) {
          throw new Error("Your wallet is not ready for this payment.");
        }
        const approval = await getBnbX402Permit2Approval({
          request: job.paymentRequest,
          ownerAddress: address,
          readContract: (args) => publicClient.readContract(args),
        });
        if (approval) {
          const approvalHash = await sendTransactionAsync({
            to: approval.to,
            data: approval.data,
            value: 0n,
            chainId: paymentChainId,
          });
          const receipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
          if (receipt.status !== "success") throw new Error("Token approval failed.");
        }
        const signed = await createBnbX402PaymentConfirmation({
          request: job.paymentRequest,
          signer: bnbX402Signer(walletClient, address),
        });
        paymentConfirmation = { paymentHeader: signed.paymentHeader };
      } else {
        const hash = await sendTransactionAsync({
          to: job.paymentRequest.to as Hex,
          data: job.paymentRequest.data as Hex,
          value: BigInt(job.paymentRequest.value),
          gas: job.paymentRequest.gasLimit ? BigInt(job.paymentRequest.gasLimit) : undefined,
          chainId: job.paymentRequest.chainId,
        });
        paymentConfirmation = { transactionHash: hash };
      }
      const response = await authFetch("/api/bnb/activate/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, ...paymentConfirmation }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Payment was sent, but the job could not be updated.");
      setJob({ record: payload.record, paymentRequest: null });
      await runJob();
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
      if (!response.ok) {
        if (payload.record) {
          setJob((current) => current ? { ...current, record: payload.record } : current);
        }
        throw new Error(payload.error || "Agent run failed.");
      }
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
      if (!(await ensureWallet(targetChainId))) return;
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
      <div className={styles.page}>
        <BnbContainer className={styles.container}>
          <div className={styles.stateSurface} role="status" aria-live="polite">
            <BnbButtonLoader size={20} />
            <span>Loading job</span>
          </div>
        </BnbContainer>
      </div>
    );
  }

  if (!authenticated && !address) {
    return (
      <div className={styles.page}>
        <BnbContainer className={styles.container}>
          <section className={styles.emptyState}>
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
          </section>
        </BnbContainer>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={styles.page}>
        <BnbContainer className={styles.container}>
          <section className={styles.emptyState}>
          <h2>Job unavailable</h2>
          <p>{error || "This job could not be loaded."}</p>
          <BnbPendingLink href="/account" className="bnb-button-dark bnb-focus" pendingLabel="Opening account">Back to account</BnbPendingLink>
          </section>
        </BnbContainer>
      </div>
    );
  }

  const record = job.record;
  const paymentNotRequired = job.paymentRequest?.status === "not_required" || record.limits.walletConfirmationRequired === false;
  const delivered = record.delivery?.status === "delivered" || record.work?.status === "completed" || record.status === "delivered" || record.status === "work_completed";
  const funded = paymentNotRequired || record.payment?.transactionStatus === "success" || record.status === "funded" || record.status === "payment_confirmed" || delivered;
  const closed = record.status === "paid" || record.status === "released" || record.status === "refunded";
  const running = record.delivery?.status === "running" || record.work?.status === "running" || record.status === "running";
  const failed = record.delivery?.status === "failed" || record.work?.status === "failed" || record.status === "failed";
  const output = record.delivery?.rawOutput || record.work?.output;
  const dataSources = record.delivery?.dataSources || record.work?.dataSources;
  const deliveryError = userFacingJobIssue(record.delivery?.error || record.work?.error || "");
  const refundBlocker = bnbRefundUnavailableReason(record);
  const showSettlementActions = record.payment?.mode === "escrow" && delivered && !closed;
  const recordChainId = record.payment?.chainId || targetChainId;
  const fundedExplorerUrl = record.payment?.explorerUrl || (record.payment?.transactionHash ? getClientBnbExplorerTxUrl(record.payment.transactionHash, recordChainId) : "");
  const settlementExplorerUrl = record.settlement?.explorerUrl || (record.settlement?.transactionHash ? getClientBnbExplorerTxUrl(record.settlement.transactionHash, recordChainId) : "");
  const taskTitle = record.jobSpec
    ? bnbJobTaskLabel(getBnbJobSpecDefinition(record.jobSpec), record.jobSpec.taskType)
    : record.limits.task;
  const lifecycle = buildJobLifecycle({ record, paymentNotRequired, funded, running, delivered, failed, closed });

  return (
    <div className={styles.page}>
      <BnbContainer className={styles.container}>
        <header className={styles.jobHeader}>
          <div className={styles.statusLine} data-state={failed ? "failed" : running ? "running" : delivered || closed ? "complete" : "pending"}>
            {running ? <BnbButtonLoader /> : <span aria-hidden="true" />}
            <strong>{jobStatusLabel(record)}</strong>
          </div>
          <h1>{taskTitle}</h1>
          <p>{record.agent.name} · Record {shortHash(record.recordId)} · Created {formatJobDate(record.createdAt)}</p>
        </header>

        <dl className={styles.factRow} aria-label="Job facts">
          {!paymentNotRequired ? <JobFact label="Maximum payment" value={record.limits.budget} /> : <JobFact label="Payment" value="Not required" />}
          <JobFact label="Network" value={recordChainId === 97 ? "BNB Smart Chain Testnet" : "BNB Smart Chain"} />
          <JobFact label="Time limit" value={record.limits.expires} />
          <JobFact label="Updated" value={formatJobDate(record.updatedAt)} />
        </dl>

        <section className={styles.actionBand} aria-labelledby="next-action-title">
          <div>
            <span>Next action</span>
            <h2 id="next-action-title">{nextActionTitle(record)}</h2>
            {nextActionCopy(record) ? <p>{nextActionCopy(record)}</p> : null}
          </div>
          <div className={styles.primaryActions}>
              {job.paymentRequest?.status === "ready" && !funded ? (
                <button type="button" className="bnb-button bnb-focus" onClick={fundJob} disabled={Boolean(action)} aria-busy={action === "fund"}>
                  {action === "fund" ? <BnbButtonLoader /> : <CreditCard aria-hidden="true" size={16} />}
                  {action === "fund" ? "Confirming..." : `Pay ${job.paymentRequest.amountLabel}`}
                </button>
              ) : null}
              {funded && !delivered && !closed && !failed ? (
                <button type="button" className="bnb-button bnb-focus" onClick={runJob} disabled={Boolean(action) || running} aria-busy={action === "run" || running}>
                  {action === "run" || running ? <BnbButtonLoader /> : <Play aria-hidden="true" size={16} />}
                  {action === "run" || running ? "Running" : "Run agent"}
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
            </div>
          {job.paymentRequest && job.paymentRequest.status !== "ready" && job.paymentRequest.status !== "not_required" ? <p className={styles.inlineError}>{userFacingJobIssue(job.paymentRequest.reason)}</p> : null}
          {error ? <p className={styles.inlineError}>{userFacingJobIssue(error)}</p> : null}
        </section>

        <div className={styles.workbench}>
          <aside className={styles.timeline} aria-labelledby="job-progress-title">
            <h2 id="job-progress-title">Progress</h2>
            <ol>
              {lifecycle.map((step) => (
                <li key={step.label} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
                  <span aria-hidden="true">{step.state === "complete" ? <CheckCircle2 size={14} /> : step.state === "current" ? <BnbButtonLoader /> : null}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          <div className={styles.resultArea}>
            <div className={styles.resultHeading}>
              <span>Result</span>
              <h2>{output ? "Delivered work" : failed ? "Work stopped" : running ? "Agent is working" : "No result yet"}</h2>
            </div>
            {output ? (
              <BnbDeliveryView output={output} jobSpec={record.jobSpec} dataSources={dataSources} />
            ) : failed || deliveryError ? (
              <div className={styles.failureState} role="alert">
                <strong>{deliveryError || userFacingJobIssue(error || "The job stopped before delivery.")}</strong>
                <p>{funded ? "The job record is saved and no payment was released." : "No payment was taken for this run."}</p>
              </div>
            ) : running ? (
              <div className={styles.runningState} role="status" aria-live="polite">
                <BnbButtonLoader />
                <div><strong>Waiting for the agent result</strong><p>You can leave this page and return from My hires.</p></div>
              </div>
            ) : (
              <div className={styles.pendingState}>
                <Play aria-hidden="true" size={18} />
                <div><strong>{funded ? "Ready to start" : "Waiting for payment"}</strong><p>{funded ? "Run the agent to begin work." : "Confirm payment before work begins."}</p></div>
              </div>
            )}
          </div>
        </div>

        <details className={styles.recordDetails}>
          <summary>Payment and record details</summary>
          <dl>
            {!paymentNotRequired ? <DataRow label="Budget" value={record.limits.budget} /> : null}
            {record.payment?.contractAddress ? (
              <DataRow label="Payment contract" value={record.payment.contractAddress} displayValue={shortHash(record.payment.contractAddress)} href={getClientBnbExplorerAddressUrl(record.payment.contractAddress, recordChainId)} copyValue={record.payment.contractAddress} />
            ) : null}
            {record.payment?.jobId ? <DataRow label="Job ID" value={record.payment.jobId} displayValue={shortHash(record.payment.jobId)} copyValue={record.payment.jobId} /> : null}
            {record.payment?.transactionHash ? (
              <DataRow label="Payment" value={record.payment.transactionHash} displayValue={shortHash(record.payment.transactionHash)} href={fundedExplorerUrl} copyValue={record.payment.transactionHash} />
            ) : null}
            {record.settlement?.transactionHash ? (
              <DataRow label="Final transaction" value={record.settlement.transactionHash} displayValue={shortHash(record.settlement.transactionHash)} href={settlementExplorerUrl} copyValue={record.settlement.transactionHash} />
            ) : null}
          </dl>
        </details>

        <footer className={styles.footerActions}>
          <BnbPendingLink href={`/agents/${record.agent.chainId}/${encodeURIComponent(record.agent.tokenId)}`} className="bnb-button-dark bnb-focus" pendingLabel="Opening profile">View agent</BnbPendingLink>
        </footer>
      </BnbContainer>
    </div>
  );
}

function JobFact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

type JobLifecycleState = "complete" | "current" | "pending" | "failed";

function buildJobLifecycle({
  record,
  paymentNotRequired,
  funded,
  running,
  delivered,
  failed,
  closed,
}: {
  record: BnbActivationRecord;
  paymentNotRequired: boolean;
  funded: boolean;
  running: boolean;
  delivered: boolean;
  failed: boolean;
  closed: boolean;
}) {
  const steps: Array<{ label: string; detail: string; state: JobLifecycleState }> = [
    { label: "Job created", detail: "Scope and limits saved", state: "complete" },
    paymentNotRequired
      ? { label: "Payment", detail: "No payment required", state: "complete" }
      : {
          label: "Payment",
          detail: funded ? "Payment confirmed" : "Confirmation required",
          state: funded ? "complete" : "current",
        },
    {
      label: "Agent work",
      detail: delivered ? "Work completed" : failed ? "Run stopped" : running ? "In progress" : funded ? "Ready to start" : "Waiting for payment",
      state: delivered ? "complete" : failed ? "failed" : running || funded ? "current" : "pending",
    },
    {
      label: "Result",
      detail: delivered ? "Result delivered" : failed ? "No result delivered" : "Waiting for delivery",
      state: delivered ? "complete" : failed ? "failed" : "pending",
    },
  ];

  if (record.payment?.mode === "escrow") {
    steps.push({
      label: record.status === "refunded" ? "Refund" : "Payment release",
      detail: record.status === "refunded" ? "Payment returned" : closed ? "Payment released" : "Waiting for approval",
      state: closed ? "complete" : delivered ? "current" : "pending",
    });
  }

  return steps;
}

function nextActionTitle(record: BnbActivationRecord) {
  const label = jobStatusLabel(record);
  if (label === "Run") return "Start the work";
  if (label === "Awaiting payment") return "Confirm payment";
  if (label === "Payment sent") return "Start the work";
  if (label === "Running") return "Work is in progress";
  if (label === "Delivered") return record.limits.walletConfirmationRequired === false ? "Review the result" : "Review and close payment";
  if (label === "Paid") return "Job complete";
  if (label === "Refunded") return "Refund complete";
  return "Review the failure";
}

function formatJobDate(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
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

function jobPaymentChainId(request: PaymentRequest | null | undefined, fallback: 56 | 97): 56 | 97 {
  if (request?.status !== "ready") return fallback;
  if (request.mode === "escrow") return request.chainId === 97 ? 97 : 56;
  try {
    return bnbX402ChainId(request);
  } catch {
    return fallback;
  }
}

function jobStatusLabel(record: BnbActivationRecord) {
  if (record.status === "paid" || record.status === "released") return "Paid";
  if (record.status === "refunded") return "Refunded";
  if (record.delivery?.status === "delivered" || record.work?.status === "completed" || record.status === "delivered" || record.status === "work_completed") return "Delivered";
  if (record.delivery?.status === "running" || record.work?.status === "running" || record.status === "running") return "Running";
  if (record.payment?.transactionStatus === "success" || record.status === "funded" || record.status === "payment_confirmed") return "Payment sent";
  if (record.status === "failed") return "Failed";
  if (record.limits.walletConfirmationRequired === false) return "Run";
  return "Awaiting payment";
}

function nextActionCopy(record: BnbActivationRecord) {
  const label = jobStatusLabel(record);
  const paymentNotRequired = record.limits.walletConfirmationRequired === false;
  if (label === "Run") return "";
  if (label === "Awaiting payment") return record.limits.walletConfirmationRequired ? "Pay to start." : "";
  if (label === "Payment sent") return "";
  if (label === "Running") return "";
  if (label === "Delivered") return paymentNotRequired ? "Review the result." : "Review the delivery.";
  if (label === "Paid") return "Payment has been released.";
  if (label === "Refunded") return "Payment has been refunded.";
  return "Check the job state and retry if needed.";
}

function userFacingJobIssue(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/requires external sign-in/i.test(text)) return "This agent needs a separate sign-in.";
  if (/cannot be run from hive|not available for jobs|no callable|does not expose a callable|no supported execution/i.test(text)) {
    return "This agent is not available for jobs.";
  }
  if (/endpoint|adapter|callable|matching/i.test(text) && /cannot run|does not expose|failed|rejected|not available/i.test(text)) {
    return "This agent cannot run this job.";
  }
  return text
    .replace(/\bMCP\b|\bA2A\b|\bx402\b/g, "agent")
    .replace(/\bendpoint\b/gi, "agent")
    .replace(/\badapter\b/gi, "agent")
    .replace(/\bcallable\b/gi, "available")
    .replace(/\s+/g, " ")
    .trim();
}
