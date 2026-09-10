"use client";

import React, { useState, useEffect, useRef } from "react";

interface FeedEvent {
  id: string;
  type: string;
  actorName?: string;
  metadata?: {
    title?: string;
    taskTitle?: string;
    category?: string;
    budget?: string;
    amount?: string;
    agentName?: string;
  };
  createdAt: string;
}

const EVENT_ICONS: Record<string, string> = {
  TaskCreated: "⚡",
  TaskCompleted: "✅",
  BidSubmitted: "📋",
  BidAccepted: "🤝",
  ProposalAccepted: "🤝",
  TokenLaunched: "🚀",
  WorkSubmitted: "🐝",
};

function formatEventText(event: FeedEvent): string {
  const name = event.actorName || "Agent";
  const title = event.metadata?.taskTitle || event.metadata?.title || "a task";
  const budget = event.metadata?.budget || event.metadata?.amount;
  const agentName = event.metadata?.agentName;

  switch (event.type) {
    case "TaskCreated":
      return `New task posted: "${title}" (${budget || "Verified"})`;
    case "TaskCompleted":
      return `"${title}" settled on Robinhood Chain${name !== "Agent" ? ` by ${name}` : ""}`;
    case "BidSubmitted":
      return `${name} submitted a proposal on "${title}"`;
    case "BidAccepted":
    case "ProposalAccepted":
      return agentName
        ? `${agentName} proposal accepted on "${title}"`
        : `Proposal accepted on "${title}"`;
    case "TokenLaunched":
      return `Token launched: ${title}`;
    case "WorkSubmitted":
      return `${name} submitted deliverable on "${title}"`;
    default:
      return `${name}: ${event.type}`;
  }
}

export function ActivityTicker() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/feed?limit=10");
        const data = await res.json();
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          setIsVisible(true);
        }
      } catch {
        // Silently fail
      }
    };

    fetchEvents();
    const pollInterval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    if (events.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 4_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [events.length]);

  if (!isVisible || events.length === 0) return null;

  const event = events[currentIndex];
  const icon = EVENT_ICONS[event.type] || "🐝";

  return (
    <div className="w-full overflow-hidden mb-6 p-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs transition-colors">
      <div className="flex items-center gap-3 px-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-green)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-green)]" />
          </span>
          <span className="text-[10px] font-mono-num font-bold uppercase tracking-wider text-[var(--accent-green)]">
            Live Pulse
          </span>
        </div>

        <div className="w-px h-3.5 bg-[var(--border-subtle)] shrink-0" />

        {/* Event text */}
        <div
          key={currentIndex}
          className="flex-1 min-w-0 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] animate-in fade-in slide-in-from-bottom-1 duration-300"
        >
          <span className="shrink-0">{icon}</span>
          <span className="truncate text-[var(--text-primary)]">
            {formatEventText(event)}
          </span>
        </div>

        {/* Indicator dots */}
        {events.length > 1 && (
          <div className="hidden sm:flex gap-1 shrink-0">
            {events.slice(0, 4).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex % Math.min(events.length, 4)
                    ? "bg-[var(--accent-green)]"
                    : "bg-[var(--text-dim)] opacity-40"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
