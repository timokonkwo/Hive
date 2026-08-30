"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useModalStatus } from "@privy-io/react-auth";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import { BellRing, BriefcaseBusiness, FileSearch, KeyRound, Scale } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { BnbContainer } from "@/app/bnb/_components/BnbUi";
import { BnbPendingLink } from "@/app/bnb/_components/BnbPendingLink";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import { getClientBnbChainId, getClientBnbNativeSymbol } from "@/lib/bnb/client-chain";
import { bnbRefundUnavailableReason } from "@/lib/bnb/settlement-state";
import type {
  BnbAccessRequestRecord,
  BnbActivationRecord,
  BnbAltanaSessionRecord,
  BnbRecordsSnapshot,
  BnbTermixComparisonRecord,
} from "@/lib/bnb/types";
import styles from "./activity.module.css";

export type ActivityFilter = "all" | "jobs" | "requests" | "alerts" | "comparisons";

type ActivityEntry =
  | { type: "jobs"; updatedAt: string; record: BnbActivationRecord }
  | { type: "requests"; updatedAt: string; record: BnbAccessRequestRecord }
  | { type: "alerts"; updatedAt: string; record: BnbAltanaSessionRecord }
  | { type: "comparisons"; updatedAt: string; record: BnbTermixComparisonRecord };

const filters: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "jobs", label: "Jobs" },
  { value: "requests", label: "Access requests" },
  { value: "alerts", label: "Wallet alerts" },
  { value: "comparisons", label: "Comparisons" },
];

export function ReceiptsClient({ embedded = false, initialFilter = "all" }: { embedded?: boolean; initialFilter?: ActivityFilter } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, login, ready, connectWallet } = useAuth();
  const { address, chainId } = useAccount();
  const { isOpen: privyModalOpen } = useModalStatus();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { authFetch } = useBnbAuthFetch();
  const targetChainId = getClientBnbChainId();
  const nativeSymbol = getClientBnbNativeSymbol();
  const [records, setRecords] = useState<BnbRecordsSnapshot | null>(null);
  const [filter, setFilterState] = useState<ActivityFilter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authReadyTimedOut, setAuthReadyTimedOut] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setFilterState(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    if (!privyModalOpen) {
      setAuthBusy(false);
      setWalletBusy(false);
    }
  }, [privyModalOpen]);

  useEffect(() => {
    if (ready || authenticated || address) {
      setAuthReadyTimedOut(false);
      return;
    }
    const timeout = window.setTimeout(() => setAuthReadyTimedOut(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [address, authenticated, ready]);

  useEffect(() => {
    if (!authenticated && !address) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    authFetch("/api/bnb/records?limit=25", { cache: "no-store" })
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

  const entries = useMemo(() => activityEntries(records), [records]);
  const visibleEntries = filter === "all" ? entries : entries.filter((entry) => entry.type === filter);
  const counts = useMemo(() => ({
    all: entries.length,
    jobs: entries.filter((entry) => entry.type === "jobs").length,
    requests: entries.filter((entry) => entry.type === "requests").length,
    alerts: entries.filter((entry) => entry.type === "alerts").length,
    comparisons: entries.filter((entry) => entry.type === "comparisons").length,
  }), [entries]);

  function setFilter(next: ActivityFilter) {
    setFilterState(next);
    if (embedded) return;
    const params = new URLSearchParams();
    if (next !== "all") params.set("filter", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function replaceActivation(record: BnbActivationRecord) {
    setRecords((current) => current ? {
      ...current,
      activations: current.activations.map((item) => item.recordId === record.recordId ? record : item),
    } : current);
  }

  function replaceAccessRequest(record: BnbAccessRequestRecord) {
    setRecords((current) => current ? {
      ...current,
      accessRequests: current.accessRequests.map((item) => item.recordId === record.recordId ? record : item),
    } : current);
  }

  function signInWithBnbWallet() {
    setAuthBusy(true);
    login({ loginMethods: ["wallet"], walletChainType: "ethereum-only" });
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
      if (chainId !== targetChainId) await switchChainAsync({ chainId: targetChainId });
      const prepareResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId, action }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare payment transaction.");
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
      if (!confirmResponse.ok) throw new Error(payload.error || "Transaction was sent, but the record could not be updated.");
      if (payload.record) replaceActivation(payload.record);
    } catch (settlementError) {
      setError(settlementError instanceof Error ? settlementError.message : "Could not update payment.");
    } finally {
      setActionId("");
    }
  }

  const authInitializing = !ready && !authenticated && !address && !authReadyTimedOut;

  if (authInitializing) {
    return <ActivityFrame embedded={embedded}><div className={styles.loadingState} role="status"><BnbButtonLoader size={20} /><span>Loading activity</span></div></ActivityFrame>;
  }

  if (!authenticated && !address) {
    if (embedded) return null;
    return (
      <ActivityFrame embedded={embedded}>
        <section className={styles.authState}>
          <KeyRound aria-hidden="true" size={20} />
          <h2>Sign in to view activity</h2>
          <p>Your work records and payment actions are private to your Hive account.</p>
          <button type="button" onClick={signInWithBnbWallet} disabled={authBusy || privyModalOpen} aria-busy={authBusy || privyModalOpen} className="bnb-button bnb-focus">
            {authBusy || privyModalOpen ? <BnbButtonLoader /> : null}
            {authBusy || privyModalOpen ? "Opening wallet..." : "Sign in"}
          </button>
        </section>
      </ActivityFrame>
    );
  }

  return (
    <ActivityFrame embedded={embedded}>
      {error ? (
        <div className={styles.errorBand} role="alert">
          <span>{error}</span>
          <button type="button" className="bnb-link-button bnb-focus" onClick={() => setReloadKey((current) => current + 1)}>Retry</button>
        </div>
      ) : null}

      <section className={styles.records} aria-labelledby="activity-records-title">
        <div className={styles.recordsHeader}>
          <div>
            <span>Records</span>
            <h2 id="activity-records-title">Your work</h2>
          </div>
          <BnbPendingLink href="/agents" className="bnb-button-dark bnb-focus" pendingLabel="Opening directory">Browse agents</BnbPendingLink>
        </div>

        <div className={styles.filterBar} role="tablist" aria-label="Filter activity">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              className="bnb-focus"
              onClick={() => setFilter(item.value)}
            >
              {item.label}{records ? <span>{counts[item.value]}</span> : null}
            </button>
          ))}
        </div>

        <div className={styles.columnHead} aria-hidden="true">
          <span>Record</span><span>Updated</span><span>Status</span><span>Amount</span><span>Action</span>
        </div>

        {loading ? (
          <div className={styles.recordsLoading} role="status" aria-label="Loading activity">
            <BnbButtonLoader size={20} />
          </div>
        ) : visibleEntries.length > 0 ? (
          <div className={styles.rows}>
            {visibleEntries.map((entry) => (
              <ActivityEntryRow
                key={`${entry.type}:${entry.record.recordId}`}
                entry={entry}
                actionId={actionId}
                walletBusy={walletBusy}
                runHire={runHire}
                settleHire={settleHire}
                cancelAccessRequest={cancelAccessRequest}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <FileSearch aria-hidden="true" size={20} />
            <strong>{entries.length > 0 ? "No records in this view" : "No activity yet"}</strong>
            <p>{entries.length > 0 ? "Choose another activity type." : "Hire an agent or create a wallet alert to add the first record."}</p>
            {entries.length === 0 ? <BnbPendingLink href="/agents" className="bnb-button bnb-focus" pendingLabel="Opening directory">Browse agents</BnbPendingLink> : null}
          </div>
        )}
      </section>
    </ActivityFrame>
  );
}

function ActivityEntryRow({
  entry,
  actionId,
  walletBusy,
  runHire,
  settleHire,
  cancelAccessRequest,
}: {
  entry: ActivityEntry;
  actionId: string;
  walletBusy: boolean;
  runHire: (record: BnbActivationRecord) => void;
  settleHire: (record: BnbActivationRecord, action: "release" | "refund") => void;
  cancelAccessRequest: (record: BnbAccessRequestRecord) => void;
}) {
  if (entry.type === "jobs") {
    const record = entry.record;
    const paymentNotRequired = record.limits.walletConfirmationRequired === false;
    const funded = paymentNotRequired || record.payment?.transactionStatus === "success";
    const completed = record.delivery?.status === "delivered" || record.work?.status === "completed" || record.status === "delivered" || record.status === "work_completed";
    const closed = record.status === "paid" || record.status === "released" || record.status === "refunded";
    const running = record.delivery?.status === "running" || record.work?.status === "running" || record.status === "running";
    const failed = record.delivery?.status === "failed" || record.work?.status === "failed" || record.status === "failed";
    const showSettlementActions = record.payment?.mode === "escrow" && completed && !closed;
    const refundBlocker = bnbRefundUnavailableReason(record);
    const href = `/jobs/${encodeURIComponent(record.recordId)}`;
    return (
      <article className={styles.activityRow}>
        <RecordIdentity icon={<BriefcaseBusiness size={16} />} type="Job" title={record.agent.name} detail={record.limits.task} href={href} />
        <time dateTime={record.updatedAt}>{formatActivityDate(record.updatedAt)}</time>
        <StatusCell label={jobStatusLabel(record)} />
        <span className={styles.amount}>{paymentNotRequired ? "Free" : record.limits.budget || "-"}</span>
        <div className={styles.rowActions}>
          {funded && !completed && !closed && !failed ? (
            <button type="button" onClick={() => runHire(record)} disabled={Boolean(actionId) || running} aria-busy={actionId === `${record.recordId}:run` || running} className="bnb-button bnb-focus">
              {actionId === `${record.recordId}:run` || running ? <BnbButtonLoader /> : null}
              {actionId === `${record.recordId}:run` || running ? "Running" : "Run agent"}
            </button>
          ) : showSettlementActions ? (
            <>
              <button type="button" onClick={() => settleHire(record, "release")} disabled={Boolean(actionId) || walletBusy} aria-busy={actionId === `${record.recordId}:release` || walletBusy} className="bnb-button bnb-focus">
                {actionId === `${record.recordId}:release` || walletBusy ? <BnbButtonLoader /> : null}
                {walletBusy ? "Opening wallet..." : actionId === `${record.recordId}:release` ? "Confirming..." : "Release"}
              </button>
              {!refundBlocker ? (
                <button
                  type="button"
                  onClick={() => settleHire(record, "refund")}
                  disabled={Boolean(actionId) || walletBusy}
                  aria-busy={actionId === `${record.recordId}:refund` || walletBusy}
                  className={styles.textAction}
                >
                  {actionId === `${record.recordId}:refund` || walletBusy ? <BnbButtonLoader /> : null}
                  {walletBusy ? "Opening wallet..." : actionId === `${record.recordId}:refund` ? "Confirming..." : "Refund"}
                </button>
              ) : null}
            </>
          ) : <BnbPendingLink href={href} className="bnb-button-dark bnb-focus" pendingLabel="Opening job">View job</BnbPendingLink>}
        </div>
      </article>
    );
  }

  if (entry.type === "requests") {
    const record = entry.record;
    const href = `/agents/${record.agent.chainId}/${encodeURIComponent(record.agent.tokenId)}`;
    return (
      <article className={styles.activityRow}>
        <RecordIdentity icon={<KeyRound size={16} />} type="Access request" title={record.agent.name} detail={record.task} href={href} />
        <time dateTime={record.updatedAt}>{formatActivityDate(record.updatedAt)}</time>
        <StatusCell label={accessRequestStatus(record)} />
        <span className={styles.amount}>{record.budget || "-"}</span>
        <div className={styles.rowActions}>
          {record.status === "requested" ? (
            <button type="button" onClick={() => cancelAccessRequest(record)} disabled={Boolean(actionId)} aria-busy={actionId === `${record.recordId}:cancel`} className={styles.textAction}>
              {actionId === `${record.recordId}:cancel` ? <BnbButtonLoader /> : null}
              {actionId === `${record.recordId}:cancel` ? "Cancelling..." : "Cancel request"}
            </button>
          ) : <BnbPendingLink href={href} className="bnb-button-dark bnb-focus" pendingLabel="Opening profile">View profile</BnbPendingLink>}
        </div>
      </article>
    );
  }

  if (entry.type === "alerts") {
    const record = entry.record;
    return (
      <article className={styles.activityRow}>
        <RecordIdentity icon={<BellRing size={16} />} type="Wallet alert" title={record.title} detail={record.walletLabel} href="/altana" />
        <time dateTime={record.updatedAt}>{formatActivityDate(record.updatedAt)}</time>
        <StatusCell label={record.status === "stopped" ? "Stopped" : record.status === "active" ? "Active" : "Saved"} />
        <span className={styles.amount}>{record.budget || "-"}</span>
        <div className={styles.rowActions}><BnbPendingLink href="/altana" className="bnb-button-dark bnb-focus" pendingLabel="Opening alert">View alert</BnbPendingLink></div>
      </article>
    );
  }

  const record = entry.record;
  const comparisonHref = record.comparisonType === "agents" ? "/agents" : "/termix";
  return (
    <article className={styles.activityRow}>
      <RecordIdentity icon={<Scale size={16} />} type="Comparison" title={record.title} detail={record.target} href={comparisonHref} />
      <time dateTime={record.updatedAt}>{formatActivityDate(record.updatedAt)}</time>
      <StatusCell label={comparisonStatus(record)} />
      <span className={styles.amount}>-</span>
      <div className={styles.rowActions}><BnbPendingLink href={comparisonHref} className="bnb-button-dark bnb-focus" pendingLabel="Opening comparison">View comparison</BnbPendingLink></div>
    </article>
  );
}

function RecordIdentity({ icon, type, title, detail, href }: { icon: React.ReactNode; type: string; title: string; detail: string; href: string }) {
  return (
    <div className={styles.recordIdentity}>
      <span aria-hidden="true">{icon}</span>
      <div>
        <small>{type}</small>
        <strong><Link href={href} className="bnb-focus">{title}</Link></strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function StatusCell({ label }: { label: string }) {
  const state = /failed|cancelled|stopped/i.test(label) ? "failed" : /paid|delivered|active|refunded|converted/i.test(label) ? "complete" : /running|submitted|sent/i.test(label) ? "current" : "pending";
  return <span className={styles.status} data-state={state}><i aria-hidden="true" />{label}</span>;
}

function ActivityFrame({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  if (embedded) return <div id="activity" className={`${styles.frame} ${styles.embedded}`}>{children}</div>;
  return <BnbContainer className={styles.frame}>{children}</BnbContainer>;
}

function activityEntries(records: BnbRecordsSnapshot | null): ActivityEntry[] {
  if (!records) return [];
  return [
    ...records.activations.map((record): ActivityEntry => ({ type: "jobs", updatedAt: record.updatedAt, record })),
    ...records.accessRequests.map((record): ActivityEntry => ({ type: "requests", updatedAt: record.updatedAt, record })),
    ...records.altanaSessions.map((record): ActivityEntry => ({ type: "alerts", updatedAt: record.updatedAt, record })),
    ...records.termixComparisons.map((record): ActivityEntry => ({ type: "comparisons", updatedAt: record.updatedAt, record })),
  ].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
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
  if (record.payment?.transactionStatus === "success" || record.status === "funded" || record.status === "payment_confirmed") return "Payment sent";
  if (record.status === "payment_submitted") return "Payment submitted";
  if (record.status === "failed") return "Failed";
  if (record.limits.walletConfirmationRequired === false) return "Ready to run";
  return "Awaiting payment";
}

function comparisonStatus(record: BnbTermixComparisonRecord) {
  if (record.verdict === "agent_better") return "Agent faster";
  if (record.verdict === "manual_better") return "Manual faster";
  if (record.verdict === "equal") return "Equal";
  return "Pending";
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(date);
}

function ensureProtectedSession({ authenticated, walletAddress, login }: { authenticated: boolean; walletAddress?: string; login: () => void }) {
  if (!authenticated && !walletAddress) {
    login();
    return false;
  }
  return true;
}
