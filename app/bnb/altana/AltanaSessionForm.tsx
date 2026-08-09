"use client";

import { useState } from "react";
import Link from "next/link";
import { bsc } from "wagmi/chains";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import type { BnbAltanaSessionTemplate } from "@/lib/bnb/types";
import { BnbSelect } from "@/app/bnb/_components/BnbSelect";

type GrantRequest =
  | {
      status: "ready";
      chainId: 56;
      to: string;
      value: string;
      data: string;
      label: string;
    }
  | {
      status: "setup_required" | "budget_needs_bnb" | "agent_wallet_invalid" | "not_ready";
      reason: string;
    };

type SessionResponse = {
  status: string;
  recordId: string;
  receiptId: string;
  message: string;
  grantRequest?: GrantRequest;
};

export function AltanaSessionForm({ templates }: { templates: BnbAltanaSessionTemplate[] }) {
  const [result, setResult] = useState<SessionResponse | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [granting, setGranting] = useState(false);
  const { authenticated, login, ready } = useAuth();
  const { address, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const authFetch = useAuthFetch();
  const templateOptions = templates.map((template) => ({ value: template.id, label: template.title }));

  async function submitSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (!authenticated) {
        login();
        return;
      }

      const response = await authFetch("/api/bnb/altana/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save wallet alert.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save wallet alert.");
    } finally {
      setSubmitting(false);
    }
  }

  async function grantSession() {
    if (!result?.grantRequest || result.grantRequest.status !== "ready") return;
    if (!authenticated || !address) {
      login();
      return;
    }

    setGranting(true);
    setError("");

    try {
      if (chainId !== bsc.id) {
        await switchChainAsync({ chainId: bsc.id });
      }

      const hash = await sendTransactionAsync({
        to: result.grantRequest.to as Hex,
        data: result.grantRequest.data as Hex,
        value: BigInt(result.grantRequest.value),
        chainId: bsc.id,
      });

      const response = await authFetch("/api/bnb/altana/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId, grantTransactionHash: hash }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Session grant was sent, but the receipt could not be updated.");
      }
      setResult(data);
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : "Could not grant session.");
    } finally {
      setGranting(false);
    }
  }

  return (
    <form onSubmit={submitSession} className="bnb-panel p-5" aria-busy={submitting}>
      <div className="flex items-center gap-2">
        <Bell aria-hidden="true" size={18} className="text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">Save wallet alert</h2>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="bnb-label">Alert type</span>
          <BnbSelect
            name="templateId"
            options={templateOptions}
            ariaLabel="Alert type"
            disabled={templateOptions.length === 0}
          />
        </label>

        <label className="block">
          <span className="bnb-label">Wallet name</span>
          <input
            name="walletLabel"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Treasury wallet"
            className="bnb-input"
          />
        </label>

        <label className="block">
          <span className="bnb-label">Wallet address</span>
          <input
            name="walletAddress"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x..."
            className="bnb-input"
          />
        </label>

        <label className="block">
          <span className="bnb-label">Alert when</span>
          <input
            name="trigger"
            type="text"
            autoComplete="off"
            placeholder="Health factor below 1.6"
            className="bnb-input"
          />
        </label>

        <label className="block">
          <span className="bnb-label">Budget</span>
          <input
            name="budget"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.01 BNB"
            className="bnb-input"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Saving..." : authenticated ? "Save alert" : ready ? "Sign in to save" : "Loading..."}
        </button>
      </div>

      {error ? <p className="bnb-error mt-4 p-3 text-sm">{error}</p> : null}
      {result ? (
        <div className="bnb-success mt-4 p-4">
          <div className="text-sm font-semibold text-emerald-300">Alert saved</div>
          <div className="mt-1 break-all font-mono text-xs text-zinc-200">Receipt {result.receiptId}</div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{result.message}</p>
          {result.grantRequest?.status === "ready" ? (
            <button
              type="button"
              onClick={grantSession}
              disabled={granting}
              className="bnb-button bnb-focus mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {granting ? "Confirming..." : "Grant session on BSC"}
            </button>
          ) : result.grantRequest ? (
            <p className="mt-3 text-sm leading-6 text-zinc-300">{result.grantRequest.reason}</p>
          ) : null}
          <Link href="/bnb/report" className="bnb-text-action bnb-focus mt-3">
            Open receipts
          </Link>
        </div>
      ) : null}
    </form>
  );
}
