"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { RobinhoodBadge } from "@/components/ui/RobinhoodBadge";
import { Bug, Lightbulb, Send, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type FeedbackType = "bug" | "feature";

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    if (title.trim().length < 5) {
      toast.error("Title must contain at least 5 characters.");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Description must contain at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          contactInfo: contactInfo.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
      } else {
        toast.error(data.error || "Failed to submit feedback.");
      }
    } catch {
      toast.error("Network communication error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-token-bg text-token-text font-sans selection:bg-[#00C805] selection:text-black relative overflow-x-hidden">
      <Navbar />

      <main className="pt-28 pb-20 relative z-10">
        <div className="max-w-xl mx-auto px-6">
          {submitted ? (
            <div className="robin-card p-10 text-center bg-token-surface border border-token-border">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#00C805]/10 border border-[#00C805]/30 flex items-center justify-center text-[#00C805]">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight text-token-text mb-2">
                Report Received
              </h1>
              <p className="text-token-dim text-sm mb-6 leading-relaxed">
                Your {type === "bug" ? "fault report" : "feature proposal"} has been queued for developer triage.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setTitle("");
                  setDescription("");
                  setContactInfo("");
                }}
                className="px-6 py-3 bg-[#00C805] hover:bg-[#00B004] text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_4px_16px_rgba(0,200,5,0.25)]"
              >
                Submit Additional Report
              </button>
            </div>
          ) : (
            <div className="robin-card p-8 bg-token-surface border border-token-border">
              <div className="text-center mb-6">
                <div className="inline-block mb-2">
                  <RobinhoodBadge label="Community Feedback" variant="live" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-token-text">
                  Protocol <span className="text-[#00C805]">Feedback</span>
                </h1>
                <p className="text-token-dim text-xs mt-1">
                  Report issues or submit feature proposals directly to core contributors.
                </p>
              </div>

              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setType("bug")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all border ${
                    type === "bug"
                      ? "bg-red-500/10 border-red-500 text-red-500"
                      : "bg-token-subtle border-token-border text-token-dim hover:text-token-text"
                  }`}
                >
                  <Bug size={14} /> Bug Report
                </button>
                <button
                  type="button"
                  onClick={() => setType("feature")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all border ${
                    type === "feature"
                      ? "bg-[#00C805]/10 border-[#00C805] text-[#00C805]"
                      : "bg-token-subtle border-token-border text-token-dim hover:text-token-text"
                  }`}
                >
                  <Lightbulb size={14} /> Feature Request
                </button>
              </div>

              {/* Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-token-dim mb-1.5 font-bold">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={type === "bug" ? "Brief summary of the issue" : "Proposed feature title"}
                    maxLength={200}
                    className="w-full bg-token-subtle border border-token-border rounded-xl px-4 py-3 text-token-text text-sm font-mono outline-none focus:border-[#00C805]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-token-dim mb-1.5 font-bold">
                    Description & Reproduction Steps
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      type === "bug"
                        ? "List exact steps to reproduce, expected behavior, and observed outcome..."
                        : "Describe the use case and expected benefit to network participants..."
                    }
                    maxLength={2000}
                    rows={5}
                    className="w-full bg-token-subtle border border-token-border rounded-xl px-4 py-3 text-token-text text-sm outline-none focus:border-[#00C805] resize-none"
                  />
                  <div className="text-right text-[10px] text-token-dim font-mono mt-1">
                    {description.length}/2000 characters
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-token-dim mb-1.5 font-bold">
                    Contact Identifier (Optional)
                  </label>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Email or X handle for follow-up"
                    className="w-full bg-token-subtle border border-token-border rounded-xl px-4 py-3 text-token-text text-sm font-mono outline-none focus:border-[#00C805]"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim() || !description.trim()}
                  className="w-full mt-2 py-3.5 bg-[#00C805] hover:bg-[#00B004] text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(0,200,5,0.25)]"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-black" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Submit {type === "bug" ? "Bug Report" : "Feature Request"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
