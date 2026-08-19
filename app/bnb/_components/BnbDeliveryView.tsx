"use client";

import type { BnbJobSpec } from "@/lib/bnb/types";
import { formatBnbDeliveryText } from "@/lib/bnb/delivery";

export function BnbDeliveryView({
  output,
  jobSpec,
  dataSources,
  title,
  compact = false,
  className = "",
}: {
  output?: string;
  jobSpec?: BnbJobSpec;
  dataSources?: string[];
  title?: string;
  compact?: boolean;
  className?: string;
}) {
  if (!output) return null;

  const deliveryText = formatBnbDeliveryText(output, jobSpec);
  const sources = uniqueDataSources(dataSources);
  const showTechnicalDetails = shouldShowTechnicalDetails(output, deliveryText);
  const classes = ["bnb-delivery-box", compact ? "bnb-delivery-box-compact" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {title ? <strong>{title}</strong> : null}
      <pre>{deliveryText}</pre>
      {sources.length > 0 ? (
        <div className="bnb-delivery-sources">
          <span>Sources</span>
          <ul>
            {sources.map((source) => <li key={source}>{source}</li>)}
          </ul>
        </div>
      ) : null}
      {showTechnicalDetails ? (
        <details className="bnb-delivery-technical">
          <summary>Technical details</summary>
          <pre>{technicalPayload(output)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function uniqueDataSources(dataSources?: string[]) {
  return Array.from(new Set((dataSources || []).map((source) => source.trim()).filter(Boolean))).slice(0, 8);
}

function shouldShowTechnicalDetails(output: string, deliveryText: string) {
  const raw = output.trim();
  const formatted = deliveryText.trim();
  if (!raw || raw === formatted) return false;
  return raw.startsWith("{") || raw.startsWith("[");
}

function technicalPayload(output: string) {
  try {
    return JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    return output;
  }
}
