"use client";

import React from "react";

interface RobinhoodBadgeProps {
  label: string;
  variant?: "green" | "live" | "neutral" | "red" | "amber";
  showDot?: boolean;
  pulseDot?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function RobinhoodBadge({
  label,
  variant = "green",
  showDot = true,
  pulseDot = true,
  className = "",
  icon,
}: RobinhoodBadgeProps) {
  const isLive = variant === "live" || variant === "green";
  const dotColorClass = {
    green: "bg-[var(--accent-green)]",
    live: "bg-[var(--accent-green)]",
    neutral: "bg-[var(--text-secondary)]",
    red: "bg-[var(--status-red)]",
    amber: "bg-[var(--status-amber)]",
  }[variant];

  const textColorClass = {
    green: "text-[var(--accent-green)]",
    live: "text-[var(--accent-green)]",
    neutral: "text-[var(--text-secondary)]",
    red: "text-[var(--status-red)]",
    amber: "text-[var(--status-amber)]",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border border-[var(--border-subtle)] bg-[var(--bg-pill)] backdrop-blur-sm ${className}`}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {pulseDot && isLive && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColorClass}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColorClass}`} />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className={textColorClass}>{label}</span>
    </span>
  );
}
