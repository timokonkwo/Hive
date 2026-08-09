"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import type { BnbAgentProfile } from "@/lib/bnb/types";

type RequestAccessFormProps = {
  agent: Pick<BnbAgentProfile, "chainId" | "tokenId" | "name" | "category">;
  showHeading?: boolean;
};

type SavedRequest = {
  recordId: string;
};

export function RequestAccessForm({ agent, showHeading = true }: RequestAccessFormProps) {
  const { authenticated, login, ready } = useAuth();
  const { authFetch } = useBnbAuthFetch();
  const [task, setTask] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contactPreference, setContactPreference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedRequest | null>(null);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!authenticated) {
      login();
      return;
    }

    if (task.trim().length < 3) {
      setError("Describe the work you need.");
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch("/api/bnb/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: agent.chainId,
          tokenId: agent.tokenId,
          task,
          budget,
          deadline,
          contactPreference,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save access request.");
      setSaved({ recordId: payload.recordId });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save access request.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="bnb-request-form" id="request-access">
        {showHeading ? <h2>Request sent</h2> : null}
        <p>{agent.name} has been added to your activity.</p>
        <dl className="bnb-request-receipt">
          <div>
            <dt>Request ID</dt>
            <dd>{saved.recordId}</dd>
          </div>
        </dl>
        <Link href="/bnb/account#activity" className="bnb-button bnb-focus">
          View activity
        </Link>
      </div>
    );
  }

  return (
    <form className="bnb-request-form" id="request-access" onSubmit={submitRequest}>
      {showHeading ? <h2>Request access</h2> : null}
      <label>
        <span>Work needed</span>
        <textarea
          value={task}
          onChange={(event) => setTask(event.target.value)}
          className="bnb-input"
          rows={4}
          maxLength={1000}
          placeholder="Describe the task, position, pool, or strategy"
          required
        />
      </label>
      <label>
        <span>Budget</span>
        <input
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          className="bnb-input"
          maxLength={120}
          placeholder="Optional"
        />
      </label>
      <label>
        <span>Deadline</span>
        <input
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className="bnb-input"
          maxLength={120}
          placeholder="Optional"
        />
      </label>
      <label>
        <span>Contact</span>
        <input
          value={contactPreference}
          onChange={(event) => setContactPreference(event.target.value)}
          className="bnb-input"
          maxLength={240}
          placeholder="Email, Telegram, or wallet message"
        />
      </label>
      {error ? <p className="bnb-form-error">{error}</p> : null}
      <button
        type="submit"
        className="bnb-button bnb-focus"
        disabled={!ready || saving}
      >
        {saving ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : null}
        {requestButtonLabel({ authenticated, saving })}
      </button>
    </form>
  );
}

function requestButtonLabel({
  authenticated,
  saving,
}: {
  authenticated: boolean;
  saving: boolean;
}) {
  if (saving) return "Sending...";
  if (!authenticated) return "Sign in to request";
  return "Send request";
}
