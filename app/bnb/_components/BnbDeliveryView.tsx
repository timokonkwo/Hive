"use client";

import { Download, ExternalLink } from "lucide-react";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import type { BnbJobSpec } from "@/lib/bnb/types";
import { normalizeBnbDelivery } from "@/lib/bnb/delivery";

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

  const rawOutput = output;
  const delivery = normalizeBnbDelivery(output, jobSpec);
  const sources = uniqueDataSources(dataSources);
  const classes = ["bnb-delivery-box", compact ? "bnb-delivery-box-compact" : "", className].filter(Boolean).join(" ");
  const modelTitle = delivery.title && delivery.title !== title ? delivery.title : "";

  function downloadData() {
    const blob = new Blob([rawOutput], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `hive-agent-result-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  return (
    <div className={classes}>
      {title ? <strong>{title}</strong> : null}
      {modelTitle ? <h4>{modelTitle}</h4> : null}
      {delivery.summary ? <p className="bnb-delivery-summary">{delivery.summary}</p> : null}
      {delivery.text ? <div className="bnb-delivery-text">{delivery.text}</div> : null}
      {delivery.facts?.length ? (
        <dl className="bnb-delivery-facts">
          {delivery.facts.map((fact, index) => (
            <div key={`${index}:${fact.label}`}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {delivery.table ? (
        <div className="bnb-delivery-table-wrap">
          <table className="bnb-delivery-table" aria-label={delivery.table.title}>
            <thead>
              <tr>
                {delivery.table.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {delivery.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, columnIndex) => (
                    <td key={`${delivery.table?.columns[columnIndex]?.key || columnIndex}:${cell.value}`}>
                      {cell.kind === "address" ? (
                        <span className="bnb-delivery-copy-value">
                          <span title={cell.value}>{cell.displayValue}</span>
                          <CopyValueButton value={cell.value} label={delivery.table?.columns[columnIndex]?.label || "value"} />
                        </span>
                      ) : cell.kind === "url" ? (
                        <a href={cell.value} target="_blank" rel="noopener noreferrer">
                          {cell.displayValue}
                          <ExternalLink aria-hidden="true" size={12} />
                        </a>
                      ) : cell.displayValue}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {delivery.table.truncated ? <p className="bnb-delivery-table-note">Showing {delivery.table.rows.length} of {delivery.table.total}</p> : null}
        </div>
      ) : null}
      {delivery.hasStructuredData ? (
        <div className="bnb-delivery-actions">
          <button type="button" className="bnb-button-dark bnb-focus" onClick={downloadData}>
            <Download aria-hidden="true" size={14} />
            Download data
          </button>
        </div>
      ) : null}
      {sources.length > 0 ? (
        <div className="bnb-delivery-sources">
          <span>Sources</span>
          <ul>
            {sources.map((source) => (
              <li key={source.key}>
                {source.href ? (
                  <a href={source.href} target="_blank" rel="noopener noreferrer">
                    {source.label}
                  </a>
                ) : (
                  source.label
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function uniqueDataSources(dataSources?: string[]) {
  const sources = new Map<string, { key: string; label: string; href?: string }>();
  for (const source of dataSources || []) {
    const display = displayDataSource(source);
    if (!display || sources.has(display.key)) continue;
    sources.set(display.key, display);
  }
  return Array.from(sources.values()).slice(0, 8);
}

function displayDataSource(source: string): { key: string; label: string; href?: string } | null {
  const text = source.trim();
  if (!text) return null;

  const url = text.match(/https?:\/\/[^\s)]+/i)?.[0]?.replace(/[.,;]+$/, "");
  if (url) {
    return {
      key: url,
      label: sourceLabel(url),
      href: url,
    };
  }

  if (/\b(?:MCP|A2A|x402|adapter|endpoint|tool)\b/i.test(text)) return null;
  return {
    key: text.toLowerCase(),
    label: text,
  };
}

function sourceLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}
