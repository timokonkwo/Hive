"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="bnb-copy-button bnb-focus"
      aria-label={`Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      onClick={copyValue}
      data-copied={copied ? "true" : undefined}
    >
      {copied ? <Check aria-hidden="true" size={13} /> : <Copy aria-hidden="true" size={13} />}
    </button>
  );
}
