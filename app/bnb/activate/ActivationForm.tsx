"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { bsc } from "wagmi/chains";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import type { BnbAgentProfile } from "@/lib/bnb/types";
import { BnbSelect } from "@/app/bnb/_components/BnbSelect";

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

const taskOptions = [
  { value: "Rebalance LP position", label: "Rebalance LP position" },
  { value: "Create grid strategy", label: "Create grid strategy" },
  { value: "Compare yield routes", label: "Compare yield routes" },
  { value: "Monitor health factor", label: "Monitor health factor" },
  { value: "Audit token or pool", label: "Audit token or pool" },
];

export function ActivationForm({ agent }: { agent: BnbAgentProfile }) {
  const [taskTemplate, setTaskTemplate] = useState("Rebalance LP position");
  const [taskDetails, setTaskDetails] = useState("");
  const [spendCap, setSpendCap] = useState("0.01 BNB");
  const [expiry, setExpiry] = useState("24 hours");
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [running, setRunning] = useState(false);
  const [settling, setSettling] = useState<"release" | "refund" | null>(null);
  const [walletAction, setWalletAction] = useState("");
  const [walletError, setWalletError] = useState("");
  const [result, setResult] = useState<ActivationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState("");
  const { authenticated, login, ready, connectWallet } = useAuth();
  const { address, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { wallets, ready: walletsReady } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { authFetch } = useBnbAuthFetch();
  const evmWallets = useMemo(
    () => wallets.filter((wallet): wallet is ConnectedWallet => wallet.type === "ethereum"),
    [wallets],
  );
  const activeWallet = evmWallets.find((wallet) => sameAddress(wallet.address, address));

  useEffect(() => {
    if (!authenticated || address || evmWallets.length === 0) return;
    setActiveWallet(evmWallets[0]).catch(() => undefined);
  }, [address, authenticated, evmWallets, setActiveWallet]);

  function openWalletConnector() {
    setWalletError("");
    connectWallet({
      walletChainType: "ethereum-only",
      description: "Connect the wallet you want to use for BNB Smart Chain transactions.",
    });
  }

  async function useWallet(wallet: ConnectedWallet) {
    setWalletAction(`wallet:${wallet.address}`);
    setWalletError("");

    try {
      await setActiveWallet(wallet);
    } catch (walletSetError) {
      setWalletError(walletSetError instanceof Error ? walletSetError.message : "Could not switch wallet.");
    } finally {
      setWalletAction("");
    }
  }

  async function switchToBsc() {
    setWalletAction("switch");
    setWalletError("");

    try {
      await switchChainAsync({ chainId: bsc.id });
    } catch (switchError) {
      setWalletError(switchError instanceof Error ? switchError.message : "Could not switch to BNB Smart Chain.");
    } finally {
      setWalletAction("");
    }
  }

  async function ensureBscWallet() {
    if (!authenticated) {
      login();
      return false;
    }

    if (!address) {
      openWalletConnector();
      setError("Connect a BNB Chain wallet to continue.");
      return false;
    }

    if (chainId !== bsc.id) {
      await switchChainAsync({ chainId: bsc.id });
    }

    return true;
  }

  async function submitActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!ensureProtectedSession({ authenticated, login })) return;

    setLoading(true);
    try {
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
    if (!ensureProtectedSession({ authenticated, login })) return;

    setFunding(true);
    setError(null);

    try {
      const walletReady = await ensureBscWallet();
      if (!walletReady) {
        return;
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
        throw new Error(payload.error || "Payment was sent, but the record could not be updated.");
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
    if (!ensureProtectedSession({ authenticated, login })) return;
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
    if (!ensureProtectedSession({ authenticated, login })) return;

    setSettling(action);
    setError(null);

    try {
      const walletReady = await ensureBscWallet();
      if (!walletReady) {
        return;
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
        throw new Error(payload.error || "Escrow transaction was sent, but the record could not be updated.");
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
  const previewRows = getHirePreviewRows({ agent, taskTemplate, spendCap, expiry });

  return (
    <form onSubmit={submitActivation} className="bnb-panel p-5" aria-busy={loading}>
      <div className="grid gap-4">
        <WalletPanel
          authenticated={authenticated}
          ready={ready}
          walletsReady={walletsReady}
          address={address}
          chainId={chainId}
          activeWallet={activeWallet}
          wallets={evmWallets}
          action={walletAction}
          error={walletError}
          onLogin={login}
          onConnect={openWalletConnector}
          onUseWallet={useWallet}
          onSwitchChain={switchToBsc}
        />

        <label>
          <span className="bnb-label">Task</span>
          <BnbSelect value={taskTemplate} onChange={setTaskTemplate} options={taskOptions} ariaLabel="Task" />
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

        <div className="bnb-hire-preview">
          <div>
            <h2>Review before signing</h2>
            <p>Saving creates the hire record. Escrow funding happens next.</p>
          </div>
          <dl>
            {previewRows.map((row) => (
              <DataRow key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        </div>

        <button
          type="submit"
          disabled={loading || !ready}
          className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving..." : hireButtonLabel({ authenticated })}
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
            <DataRow label="Record" value={result.receiptId} />
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
              {funding ? "Confirming..." : `Fund escrow (${result.paymentRequest.amountLabel})`}
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

function WalletPanel({
  authenticated,
  ready,
  walletsReady,
  address,
  chainId,
  activeWallet,
  wallets,
  action,
  error,
  onLogin,
  onConnect,
  onUseWallet,
  onSwitchChain,
}: {
  authenticated: boolean;
  ready: boolean;
  walletsReady: boolean;
  address?: string;
  chainId?: number;
  activeWallet?: ConnectedWallet;
  wallets: ConnectedWallet[];
  action: string;
  error: string;
  onLogin: () => void;
  onConnect: () => void;
  onUseWallet: (wallet: ConnectedWallet) => void;
  onSwitchChain: () => void;
}) {
  const onBsc = chainId === bsc.id;

  return (
    <div className="bnb-wallet-panel">
      <div className="bnb-wallet-head">
        <div>
          <h2>Wallet</h2>
          <p>{walletSummary({ authenticated, walletsReady, address, chainId })}</p>
        </div>
        <span className={`bnb-chip ${authenticated && address && onBsc ? "bnb-chip-active" : ""}`}>
          {authenticated && address && onBsc ? "Ready" : authenticated ? "Needs wallet" : "Signed out"}
        </span>
      </div>

      {!authenticated ? (
        <button type="button" className="bnb-button-dark bnb-focus" onClick={onLogin} disabled={!ready}>
          Sign in
        </button>
      ) : null}

      {authenticated && walletsReady && wallets.length === 0 ? (
        <button type="button" className="bnb-button-dark bnb-focus" onClick={onConnect}>
          Connect wallet
        </button>
      ) : null}

      {authenticated && wallets.length > 0 ? (
        <div className="bnb-wallet-list">
          {wallets.map((wallet) => {
            const active = sameAddress(wallet.address, address);
            return (
              <button
                key={`${wallet.walletClientType}:${wallet.address}`}
                type="button"
                className="bnb-wallet-row bnb-focus"
                data-active={active ? "true" : undefined}
                onClick={() => onUseWallet(wallet)}
                disabled={action === `wallet:${wallet.address}`}
              >
                <span>
                  <strong>{wallet.meta?.name || wallet.walletClientType || "Wallet"}</strong>
                  <small>{shortAddress(wallet.address)}</small>
                </span>
                <span>{active ? "Active" : action === `wallet:${wallet.address}` ? "Switching..." : "Use"}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {authenticated && address ? (
        <div className="bnb-wallet-actions">
          {chainId !== bsc.id ? (
            <button type="button" className="bnb-button bnb-focus" onClick={onSwitchChain} disabled={action === "switch"}>
              {action === "switch" ? "Switching..." : "Switch to BNB Chain"}
            </button>
          ) : null}
          <button type="button" className="bnb-button-dark bnb-focus" onClick={onConnect}>
            {activeWallet ? "Change wallet" : "Connect wallet"}
          </button>
        </div>
      ) : null}

      {error ? <p className="bnb-form-error">{error}</p> : null}
    </div>
  );
}

function hireButtonLabel({
  authenticated,
}: {
  authenticated: boolean;
}) {
  if (!authenticated) return "Sign in to hire";
  return "Create hire";
}

function ensureProtectedSession({
  authenticated,
  login,
}: {
  authenticated: boolean;
  login: () => void;
}) {
  if (!authenticated) {
    login();
    return false;
  }

  return true;
}

function walletSummary({
  authenticated,
  walletsReady,
  address,
  chainId,
}: {
  authenticated: boolean;
  walletsReady: boolean;
  address?: string;
  chainId?: number;
}) {
  if (!authenticated) return "Sign in before saving a hire.";
  if (!walletsReady) return "Loading wallets.";
  if (!address) return "Connect a wallet when you are ready to fund escrow.";
  if (chainId !== bsc.id) return `${shortAddress(address)} is connected on another network.`;
  return `${shortAddress(address)} is connected on BNB Smart Chain.`;
}

function sameAddress(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function getHirePreviewRows({
  agent,
  taskTemplate,
  spendCap,
  expiry,
}: {
  agent: BnbAgentProfile;
  taskTemplate: string;
  spendCap: string;
  expiry: string;
}) {
  const service = agent.services.find((item) => item.price) || agent.services[0];
  const fee = service?.price || "";
  const rows = [
    { label: "Agent", value: agent.name },
    { label: "Work", value: taskTemplate },
    { label: "Budget", value: spendCap },
    { label: "Time limit", value: expiry },
    { label: "Payment", value: "BNB escrow" },
    { label: "Expected output", value: expectedOutput(taskTemplate) },
    { label: "Settlement", value: "Release or refund" },
  ];

  if (fee) {
    rows.splice(3, 0, { label: "Agent fee", value: fee });
  }

  return rows;
}

function expectedOutput(taskTemplate: string) {
  const normalized = taskTemplate.toLowerCase();
  if (normalized.includes("rebalance")) return "LP range recommendation";
  if (normalized.includes("grid")) return "Grid strategy plan";
  if (normalized.includes("yield")) return "Ranked route report";
  if (normalized.includes("health")) return "Health factor alert";
  if (normalized.includes("audit")) return "Risk report";
  return "Agent result and work record";
}
