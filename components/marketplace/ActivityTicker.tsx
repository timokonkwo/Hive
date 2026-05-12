"use client";

import { useState, useEffect, useRef } from "react";

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
  const name = event.actorName || "Someone";
  const title = event.metadata?.taskTitle || event.metadata?.title || "a task";
  const budget = event.metadata?.budget || event.metadata?.amount;
  const agentName = event.metadata?.agentName;

  switch (event.type) {
    case "TaskCreated":
      return `New task: "${title}"${budget ? ` — ${budget}` : ""}`;
    case "TaskCompleted":
      return `"${title}" completed${name !== "Someone" ? ` by ${name}` : ""}`;
    case "BidSubmitted":
      return `${name} submitted a proposal on "${title}"`;
    case "BidAccepted":
    case "ProposalAccepted":
      // Use agent name from metadata for accepted bids
      return agentName
        ? `${agentName}'s proposal accepted on "${title}"`
        : `Proposal accepted on "${title}"`;
    case "TokenLaunched":
      return `Token launched: ${title}`;
    case "WorkSubmitted":
      return `${name} submitted work on "${title}"`;
    default:
      return `${name} — ${event.type}`;
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityTicker() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch events
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
        // Silently fail — ticker is non-critical
      }
    };

    fetchEvents();
    // Refresh every 30 seconds
    const pollInterval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(pollInterval);
  }, []);

  // Cycle through events
  useEffect(() => {
    if (events.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 4_000); // Change event every 4 seconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [events.length]);

  if (!isVisible || events.length === 0) return null;

  const event = events[currentIndex];
  const icon = EVENT_ICONS[event.type] || "🐝";

  return (
    <div
      className="w-full overflow-hidden mb-6 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-md shadow-sm transition-all hover:bg-white/[0.03]"
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-500"
            style={{ animation: "pulse 2s infinite" }}
          />
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "rgba(16,185,129,0.8)" }}
          >
            Live
          </span>
        </div>

        {/* Divider */}
        <div
          className="w-px h-4 shrink-0"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />

        {/* Event text */}
        <div
          className="flex-1 min-w-0 flex items-center gap-2 transition-opacity duration-500"
          key={currentIndex}
          style={{ animation: "fadeSlideIn 0.5s ease-out" }}
        >
          <span className="text-sm shrink-0">{icon}</span>
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: "rgba(228,228,231,0.9)" }}
          >
            {formatEventText(event)}
          </span>
        </div>

        {/* Dot indicators */}
        {events.length > 1 && (
          <div className="flex gap-1 shrink-0">
            {events.slice(0, 5).map((_, i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full transition-colors duration-300"
                style={{
                  background:
                    i === currentIndex % Math.min(events.length, 5)
                      ? "rgba(16,185,129,0.6)"
                      : "rgba(63,63,70,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
