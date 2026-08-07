"use client";

import { useState } from "react";
import { bsc } from "wagmi/chains";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import type { BnbAgentProfile } from "@/lib/bnb/types";

type PaymentRequest =
  | {
      status: "ready";
      chainId: 56;
      contractAddress?: string;
      to: string;
      value: string;
      data: string;
      amountLabel: string;
      expiresAt: number;
    }
  | {
      status: "setup_required" | "budget_needs_bnb" | "agent_wallet_invalid";
      reason: string;
    };

type SettlementRequest =
  | {
      status: "ready";
      chainId: 56;
      to: string;
      value: string;
      data: string;
      label: string;
      action: "release" | "refund";
      jobId: string;
    }
  | {
      status: "setup_required" | "not_ready";
      reason: string;
    };

type ActivationRecordView = {
  status: string;
  work?: {
    status: "not_started" | "running" | "completed" | "failed";
    output?: string;
    error?: string;
    dataSources?: string[];
  };
  payment?: {
    transactionStatus?: "success" | "reverted" | "pending";
    transactionHash?: string;
    explorerUrl?: string;
    jobId?: string;
  };
  settlement?: {
    action: "release" | "refund";
    transactionStatus?: "success" | "reverted" | "pending";
    explorerUrl?: string;
  };
};

type ActivationResponse = {
  status: string;
  message: string;
  receiptId: string;
  recordId: string;
  limits: {
    task: string;
    budget: string;
    expires: string;
    walletConfirmationRequired: boolean;
  };
  paymentRequest: PaymentRequest;
  record?: ActivationRecordView;
};

export function ActivationForm({ agent }: { agent: BnbAgentProfile }) {
  const [taskTemplate, setTaskTemplate] = useState("Rebalance LP position");
  const [taskDetails, setTaskDetails] = useState("");
  const [spendCap, setSpendCap] = useState("0.01 BNB");
  const [expiry, setExpiry] = useState("24 hours");
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [running, setRunning] = useState(false);
  const [settling, setSettling] = useState<"release" | "refund" | null>(null);
  const [result, setResult] = useState<ActivationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState("");
  const { authenticated, login, ready } = useAuth();
  const { address, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const authFetch = useAuthFetch();

  async function submitActivation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!authenticated) {
        login();
        return;
      }

      const response = await authFetch("/api/bnb/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: agent.chainId,
          tokenId: agent.tokenId,
          taskTemplate,
          taskDetails,
          spendCap,
          expiry,
          clientAddress: address,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Could not save hire");
      }
      setResult(payload);
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Could not save hire");
    } finally {
      setLoading(false);
    }
  }

  async function fundEscrow() {
    if (!result || result.paymentRequest.status !== "ready") return;
    if (!authenticated || !address) {
      login();
      return;
    }

    setFunding(true);
    setError(null);

    try {
      if (chainId !== bsc.id) {
        await switchChainAsync({ chainId: bsc.id });
      }

      const hash = await sendTransactionAsync({
        to: result.paymentRequest.to as Hex,
        data: result.paymentRequest.data as Hex,
        value: BigInt(result.paymentRequest.value),
        chainId: bsc.id,
      });

      setPaymentHash(hash);

      const response = await authFetch("/api/bnb/activate/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId, transactionHash: hash }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Payment was sent, but the receipt could not be updated.");
      }
      setResult((current) => current ? { ...current, status: payload.status, message: payload.message, record: payload.record } : current);
    } catch (fundingError) {
      setError(fundingError instanceof Error ? fundingError.message : "Could not fund escrow.");
    } finally {
      setFunding(false);
    }
  }

  async function runAgent() {
    if (!result) return;
    setRunning(true);
    setError(null);

    try {
      const response = await authFetch("/api/bnb/activate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Agent work failed.");
      }
      setResult((current) => current ? { ...current, status: payload.status, message: payload.message, record: payload.record } : current);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Agent work failed.");
    } finally {
      setRunning(false);
    }
  }

  async function settleEscrow(action: "release" | "refund") {
    if (!result) return;
    if (!authenticated || !address) {
      login();
      return;
    }

    setSettling(action);
    setError(null);

    try {
      if (chainId !== bsc.id) {
        await switchChainAsync({ chainId: bsc.id });
      }

      const prepareResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId, action }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) {
        throw new Error(prepared.error || "Could not prepare escrow transaction.");
      }

      const settlementRequest = prepared.settlementRequest as SettlementRequest;
      if (settlementRequest.status !== "ready") {
        throw new Error(settlementRequest.reason);
      }

      const hash = await sendTransactionAsync({
        to: settlementRequest.to as Hex,
        data: settlementRequest.data as Hex,
        value: BigInt(settlementRequest.value),
        chainId: bsc.id,
      });

      const confirmResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId, action, transactionHash: hash }),
      });
      const payload = await confirmResponse.json();
      if (!confirmResponse.ok) {
        throw new Error(payload.error || "Escrow transaction was sent, but the receipt could not be updated.");
      }

      setResult((current) => current ? { ...current, status: payload.status, message: payload.message, record: payload.record } : current);
    } catch (settlementError) {
      setError(settlementError instanceof Error ? settlementError.message : "Could not update escrow.");
    } finally {
      setSettling(null);
    }
  }

  const funded = result?.record?.payment?.transactionStatus === "success" || result?.status === "payment_confirmed" || result?.status === "work_completed";
  const completed = result?.record?.work?.status === "completed" || result?.status === "work_completed";
  const closed = result?.status === "released" || result?.status === "refunded";

  return (
    <form onSubmit={submitActivation} className="bnb-panel p-5" aria-busy={loading}>
      <div className="grid gap-4">
        <label>
          <span className="bnb-label">Task</span>
          <select value={taskTemplate} onChange={(event) => setTaskTemplate(event.target.value)} className="bnb-select">
            <option>Rebalance LP position</option>
            <option>Create grid strategy</option>
            <option>Compare yield routes</option>
            <option>Monitor health factor</option>
            <option>Audit token or pool</option>
          </select>
        </label>
        <label>
          <span className="bnb-label">Work details</span>
          <textarea
            value={taskDetails}
            onChange={(event) => setTaskDetails(event.target.value)}
            className="bnb-textarea"
            placeholder="Add a wallet, token, pool, pair, route, or risk target."
          />
        </label>
        <label>
          <span className="bnb-label">Spend cap</span>
          <input value={spendCap} onChange={(event) => setSpendCap(event.target.value)} className="bnb-input" />
        </label>
        <label>
          <span className="bnb-label">Expiry</span>
          <input value={expiry} onChange={(event) => setExpiry(event.target.value)} className="bnb-input" />
        </label>
        <button type="submit" disabled={loading} className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Saving..." : authenticated ? "Save hire" : ready ? "Sign in to hire" : "Loading..."}
        </button>
      </div>

      {error ? <div className="bnb-error mt-4 p-4 text-sm">{error}</div> : null}

      {result ? (
        <div className="bnb-success mt-4 p-4">
          <div className="text-sm font-semibold text-emerald-300">
            {result.status === "payment_confirmed" ? "Escrow funded" : "Hire saved"}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-200">{result.message}</p>
          <dl className="mt-4">
            <DataRow label="Receipt" value={result.receiptId} />
            <DataRow label="Task" value={result.limits.task} />
            <DataRow label="Budget" value={result.limits.budget} />
            <DataRow label="Expires" value={result.limits.expires} />
            {paymentHash ? <DataRow label="Transaction" value={paymentHash} /> : null}
          </dl>
          {result.record?.work?.output ? (
            <div className="mt-4 rounded border border-emerald-400/20 bg-black/30 p-3">
              <div className="text-xs font-semibold uppercase text-emerald-300">Agent output</div>
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{result.record.work.output}</pre>
            </div>
          ) : null}
          {result.record?.work?.error ? (
            <div className="bnb-error mt-4 p-3 text-sm">{result.record.work.error}</div>
          ) : null}
          {result.paymentRequest.status === "ready" && !funded ? (
            <button
              type="button"
              onClick={fundEscrow}
              disabled={funding || !ready}
              className="bnb-button bnb-focus mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {funding ? "Confirming..." : authenticated ? `Fund escrow (${result.paymentRequest.amountLabel})` : "Connect wallet"}
            </button>
          ) : result.paymentRequest.status !== "ready" ? (
            <p className="mt-4 text-sm leading-6 text-zinc-300">{result.paymentRequest.reason}</p>
          ) : null}
          {funded && !completed && !closed ? (
            <button
              type="button"
              onClick={runAgent}
              disabled={running}
              className="bnb-button bnb-focus mt-3 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Running..." : "Run agent"}
            </button>
          ) : null}
          {completed && !closed ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => settleEscrow("release")}
                disabled={Boolean(settling)}
                className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
              >
                {settling === "release" ? "Confirming..." : "Release escrow"}
              </button>
              <button
                type="button"
                onClick={() => settleEscrow("refund")}
                disabled={Boolean(settling)}
                className="bnb-button bnb-button-secondary bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
              >
                {settling === "refund" ? "Confirming..." : "Refund after expiry"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bnb-data-row">
      <dt>{label}</dt>
      <dd className="break-all text-right bnb-mono text-zinc-200">{value}</dd>
    </div>
  );
}
