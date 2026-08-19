"use client";

import { useEffect, useState } from "react";
import { useModalStatus } from "@privy-io/react-auth";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import { Ban } from "lucide-react";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import { getClientBnbChainId, getClientBnbNativeSymbol } from "@/lib/bnb/client-chain";

type RevokeRequest =
  | {
      status: "ready";
      chainId: number;
      to: string;
      value: string;
      data: string;
      label: string;
    }
  | {
      status: "setup_required" | "not_ready";
      reason: string;
    };

type RevokeResponse = {
  status: string;
  recordId: string;
  receiptId: string;
  message: string;
  revokeRequest?: RevokeRequest;
};

export function AltanaRevokeForm() {
  const [result, setResult] = useState<RevokeResponse | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [lastNote, setLastNote] = useState("");
  const { authenticated, login, ready, connectWallet } = useAuth();
  const { address, chainId } = useAccount();
  const { isOpen: privyModalOpen } = useModalStatus();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { authFetch } = useBnbAuthFetch();
  const targetChainId = getClientBnbChainId();
  const nativeSymbol = getClientBnbNativeSymbol();

  useEffect(() => {
    if (!privyModalOpen) {
      setAuthBusy(false);
      setWalletBusy(false);
    }
  }, [privyModalOpen]);

  function signInWithBnbWallet() {
    setAuthBusy(true);
    login({
      loginMethods: ["wallet"],
      walletChainType: "ethereum-only",
    });
  }

  async function revokeSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;

    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    setLastNote(typeof payload.revocationNote === "string" ? payload.revocationNote : "");

    try {
      const response = await authFetch("/api/bnb/altana/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not stop wallet alert.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop wallet alert.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRevoke() {
    if (!result?.revokeRequest || result.revokeRequest.status !== "ready") return;
    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;
    if (!address) {
      setWalletBusy(true);
      connectWallet({
        walletChainType: "ethereum-only",
        description: `Connect the wallet you want to use for ${nativeSymbol} transactions.`,
      });
      return;
    }

    setConfirming(true);
    setError("");

    try {
      if (chainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }

      const hash = await sendTransactionAsync({
        to: result.revokeRequest.to as Hex,
        data: result.revokeRequest.data as Hex,
        value: BigInt(result.revokeRequest.value),
        chainId: targetChainId,
      });

      const response = await authFetch("/api/bnb/altana/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId, revocationNote: lastNote, revokeTransactionHash: hash }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Revoke transaction was sent, but the record could not be updated.");
      }
      setResult(data);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Could not revoke session.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <form onSubmit={revokeSession} className="bnb-panel p-5" aria-busy={submitting}>
      <div className="flex items-center gap-2">
        <Ban aria-hidden="true" size={18} className="text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">Stop wallet alert</h2>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="bnb-label">Alert ID</span>
          <input
            name="recordId"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste alert record ID"
            className="bnb-input"
            required
          />
        </label>

        <label className="block">
          <span className="bnb-label">Note</span>
          <textarea
            name="revocationNote"
            rows={3}
            placeholder="Why are you stopping this alert?"
            className="bnb-textarea"
          />
        </label>

        <button
          type="submit"
          disabled={submitting || authBusy || (!ready && !address)}
          aria-busy={submitting || authBusy}
          className="bnb-button bnb-button-secondary bnb-focus disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting || authBusy ? <BnbButtonLoader /> : null}
          {revokeButtonLabel({ submitting, authenticated, walletAddress: address, ready, authBusy })}
        </button>
      </div>

      {error ? <p className="bnb-error mt-4 p-3 text-sm">{error}</p> : null}
      {result ? (
        <div className="bnb-success mt-4 p-4">
          <div className="text-sm font-semibold text-emerald-300">
            {result.revokeRequest?.status === "ready" ? "Confirm revoke" : result.status === "stopped" ? "Alert stopped" : "Revoke submitted"}
          </div>
          <div className="mt-1 break-all font-mono text-xs text-zinc-200">Record {result.recordId}</div>
          {result.message ? <p className="mt-2 text-sm leading-6 text-zinc-300">{result.message}</p> : null}
          {result.revokeRequest?.status === "ready" ? (
            <button
              type="button"
              onClick={confirmRevoke}
              disabled={confirming || walletBusy}
              aria-busy={confirming || walletBusy}
              className="bnb-button bnb-focus mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirming || walletBusy ? <BnbButtonLoader /> : null}
              {walletBusy ? "Opening wallet..." : confirming ? "Confirming..." : `Revoke session on ${nativeSymbol}`}
            </button>
          ) : result.revokeRequest ? (
            <p className="mt-3 text-sm leading-6 text-zinc-300">{result.revokeRequest.reason}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function revokeButtonLabel({
  submitting,
  authenticated,
  walletAddress,
  ready,
  authBusy,
}: {
  submitting: boolean;
  authenticated: boolean;
  walletAddress?: string;
  ready: boolean;
  authBusy: boolean;
}) {
  if (authBusy) return "Opening wallet...";
  if (submitting) return "Stopping...";
  if (!ready && !walletAddress) return "Loading...";
  if (!authenticated && !walletAddress) return "Sign in to stop";
  return "Stop alert";
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
