"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bsc } from "wagmi/chains";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import { FileText, Loader2 } from "lucide-react";
import { BnbContainer, BnbPanel } from "@/app/bnb/_components/BnbUi";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import type { BnbActivationRecord, BnbRecordsSnapshot } from "@/lib/bnb/types";

type ReceiptRow = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  href?: string;
};

export function ReceiptsClient() {
  const { authenticated, login, ready } = useAuth();
  const { address, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const authFetch = useAuthFetch();
  const [records, setRecords] = useState<BnbRecordsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    authFetch("/api/bnb/records?limit=25")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load receipts.");
        if (!cancelled) setRecords(payload);
      })
      .catch((receiptError) => {
        if (!cancelled) setError(receiptError instanceof Error ? receiptError.message : "Could not load receipts.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated, authFetch]);

  const rows = useMemo(() => {
    if (!records) return [];

    const hires: ReceiptRow[] = records.activations.map((record) => ({
      id: record.recordId,
      title: record.agent.name,
      detail: record.limits.task,
      meta: record.payment?.transactionStatus === "success" ? "Escrow funded" : record.status === "payment_submitted" ? "Payment submitted" : "Hire saved",
      href: `/bnb/activate?chainId=${record.agent.chainId}&tokenId=${encodeURIComponent(record.agent.tokenId)}`,
    }));

    const comparisons: ReceiptRow[] = records.termixComparisons.map((record) => ({
      id: record.recordId,
      title: record.title,
      detail: `${record.target} / ${record.manualTime || "manual time"} vs ${record.agentTime || "agent time"}`,
      meta: record.qualityScore ? `${record.verdict} / ${record.qualityScore}` : record.verdict,
      href: "/bnb/termix",
    }));

    const alerts: ReceiptRow[] = records.altanaSessions.map((record) => ({
      id: record.recordId,
      title: record.title,
      detail: record.walletAddress ? `${record.walletLabel} / ${record.walletAddress}` : record.walletLabel,
      meta: record.status === "stopped" ? "Stopped" : "Active",
      href: "/bnb/altana",
    }));

    return [...hires, ...comparisons, ...alerts];
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

  async function runHire(record: BnbActivationRecord) {
    setActionId(`${record.recordId}:run`);
    setError("");

    try {
      const response = await authFetch("/api/bnb/activate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Agent work failed.");
      if (payload.record) replaceActivation(payload.record);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Agent work failed.");
    } finally {
      setActionId("");
    }
  }

  async function settleHire(record: BnbActivationRecord, action: "release" | "refund") {
    if (!authenticated || !address) {
      login();
      return;
    }

    setActionId(`${record.recordId}:${action}`);
    setError("");

    try {
      if (chainId !== bsc.id) {
        await switchChainAsync({ chainId: bsc.id });
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
        chainId: bsc.id,
      });

      const confirmResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.recordId, action, transactionHash: hash }),
      });
      const payload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(payload.error || "Escrow transaction was sent, but the receipt could not be updated.");
      if (payload.record) replaceActivation(payload.record);
    } catch (settlementError) {
      setError(settlementError instanceof Error ? settlementError.message : "Could not update escrow.");
    } finally {
      setActionId("");
    }
  }

  if (!ready) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="p-6">
          <Loader2 aria-hidden="true" className="animate-spin text-emerald-400" size={20} />
        </BnbPanel>
      </BnbContainer>
    );
  }

  if (!authenticated) {
    return (
      <BnbContainer className="bnb-section">
        <BnbPanel className="p-6">
          <h2 className="text-xl font-semibold text-white">Sign in to view receipts</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Receipts are private to your Hive account.</p>
          <button type="button" onClick={() => login()} className="bnb-button bnb-focus mt-5">
            Sign in
          </button>
        </BnbPanel>
      </BnbContainer>
    );
  }

  return (
    <BnbContainer className="bnb-section">
      {error ? (
        <div className="bnb-error mb-4 p-4 text-sm">
          {error}
        </div>
      ) : null}

      <section className="bnb-list-panel">
        <div className="bnb-list-head">
          <div>
            <h2>Saved receipts</h2>
            <p>Hires, wallet alerts, comparisons, and payment updates.</p>
          </div>
          <Link href="/bnb" className="bnb-text-action bnb-focus">Find agents</Link>
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
                const funded = record.payment?.transactionStatus === "success";
                const completed = record.work?.status === "completed";
                const closed = record.status === "released" || record.status === "refunded";
                return (
                  <article key={record.recordId} className="bnb-receipt-row">
                    <span>
                      <span className="flex items-center gap-2 text-sm font-semibold text-white">
                        <FileText aria-hidden="true" size={15} />
                        {record.agent.name}
                      </span>
                      <span className="mt-1 block break-all text-sm leading-6 text-zinc-500">{record.limits.task}</span>
                      {record.work?.output ? (
                        <pre className="mt-3 whitespace-pre-wrap rounded border border-zinc-800 bg-black/30 p-3 text-xs leading-5 text-zinc-300">{record.work.output}</pre>
                      ) : null}
                    </span>
                    <span className="grid gap-2 justify-items-start sm:justify-items-end">
                      <span className="bnb-chip">{funded ? completed ? "Work complete" : "Funded" : record.status}</span>
                      {funded && !completed && !closed ? (
                        <button
                          type="button"
                          onClick={() => runHire(record)}
                          disabled={Boolean(actionId)}
                          className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionId === `${record.recordId}:run` ? "Running..." : "Run agent"}
                        </button>
                      ) : null}
                      {completed && !closed ? (
                        <span className="grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => settleHire(record, "release")}
                            disabled={Boolean(actionId)}
                            className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionId === `${record.recordId}:release` ? "Confirming..." : "Release"}
                          </button>
                          <button
                            type="button"
                            onClick={() => settleHire(record, "refund")}
                            disabled={Boolean(actionId)}
                            className="bnb-button bnb-button-secondary bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionId === `${record.recordId}:refund` ? "Confirming..." : "Refund"}
                          </button>
                        </span>
                      ) : null}
                    </span>
                  </article>
                );
              })}
              {rows.filter((row) => !records?.activations.some((record) => record.recordId === row.id)).map((row) => (
                <Link key={row.id} href={row.href || "/bnb/report"} className="bnb-receipt-row bnb-focus">
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
              <h2 className="text-xl font-semibold text-white">No receipts yet</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Hire an agent or save a wallet alert to create your first receipt.</p>
              <Link href="/bnb" className="bnb-button bnb-focus mt-5">
                Find agents
              </Link>
            </div>
          )}
        </BnbPanel>
      </section>
    </BnbContainer>
  );
}
