"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFetch } from "@/hooks/useAuthFetch";
import type { BnbTermixCapture } from "@/lib/bnb/types";
import { BnbSelect } from "@/app/bnb/_components/BnbSelect";

type CaptureResponse = {
  status: string;
  recordId: string;
  receiptId: string;
  message: string;
};

const verdictOptions = [
  { value: "pending", label: "Pending verification" },
  { value: "agent_better", label: "Agent better" },
  { value: "equal", label: "Equal" },
  { value: "manual_better", label: "Manual better" },
];

export function TermixCaptureForm({ captures }: { captures: BnbTermixCapture[] }) {
  const [result, setResult] = useState<CaptureResponse | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { authenticated, login, ready } = useAuth();
  const authFetch = useAuthFetch();
  const captureOptions = captures.map((capture) => ({ value: capture.id, label: capture.title }));

  async function submitCapture(event: React.FormEvent<HTMLFormElement>) {
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

      const response = await authFetch("/api/bnb/termix/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save comparison record.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save comparison record.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitCapture} className="bnb-panel p-5" aria-busy={submitting}>
      <div className="flex items-center gap-2">
        <ClipboardCheck aria-hidden="true" size={18} className="text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">Save comparison</h2>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="bnb-label">Comparison type</span>
          <BnbSelect
            name="caseId"
            options={captureOptions}
            ariaLabel="Comparison type"
            disabled={captureOptions.length === 0}
          />
        </label>

        <label className="block">
          <span className="bnb-label">Target address or route</span>
          <input
            name="target"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x... or BNB/USDT route"
            className="bnb-input"
            required
          />
        </label>

        <div className="grid gap-4">
          <label className="block">
            <span className="bnb-label">Manual time</span>
            <input
              name="manualTime"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="45 min"
              className="bnb-input"
            />
          </label>
          <label className="block">
            <span className="bnb-label">Agent time</span>
            <input
              name="agentTime"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="2 min"
              className="bnb-input"
            />
          </label>
          <label className="block">
            <span className="bnb-label">Agent token ID</span>
            <input
              name="agentTokenId"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="hive-audit-lens"
              className="bnb-input"
            />
          </label>
        </div>

        <label className="block">
          <span className="bnb-label">Verdict</span>
          <BnbSelect
            name="verdict"
            defaultValue="pending"
            options={verdictOptions}
            ariaLabel="Verdict"
          />
        </label>

        <label className="block">
          <span className="bnb-label">Manual output</span>
          <textarea
            name="manualOutput"
            rows={3}
            placeholder="Summarize the manual answer or decision."
            className="bnb-textarea"
          />
        </label>

        <label className="block">
          <span className="bnb-label">Agent output</span>
          <textarea
            name="agentOutput"
            rows={3}
            placeholder="Summarize the agent answer, checklist, or receipt."
            className="bnb-textarea"
          />
        </label>

        <label className="block">
          <span className="bnb-label">Quality score</span>
          <input
            name="qualityScore"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="8/10"
            className="bnb-input"
          />
        </label>

        <label className="block">
          <span className="bnb-label">Output artifact URL</span>
          <input
            name="artifactUrl"
            type="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="https://..."
            className="bnb-input"
          />
        </label>

        <label className="block">
          <span className="bnb-label">BSC transaction hash</span>
          <input
            name="transactionHash"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x..."
            className="bnb-input"
          />
        </label>

        <label className="block">
          <span className="bnb-label">Notes</span>
          <textarea
            name="notes"
            rows={4}
            placeholder="Summarize the result and final decision."
            className="bnb-textarea"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="bnb-button bnb-focus disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Saving..." : authenticated ? "Save comparison" : ready ? "Sign in to save" : "Loading..."}
        </button>
      </div>

      {error ? <p className="bnb-error mt-4 p-3 text-sm">{error}</p> : null}
      {result ? (
        <div className="bnb-success mt-4 p-4">
          <div className="text-sm font-semibold text-emerald-300">Comparison saved</div>
          <div className="mt-1 break-all font-mono text-xs text-zinc-200">Receipt {result.receiptId}</div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{result.message}</p>
          <Link href="/bnb/report" className="bnb-text-action bnb-focus mt-3">
            Open receipts
          </Link>
        </div>
      ) : null}
    </form>
  );
}
