"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Bug, Lightbulb, Send, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
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
      toast.error("Title must be at least 5 characters.");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Description must be at least 10 characters.");
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
        toast.error(data.error || "Failed to submit.");
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black relative overflow-x-hidden">
      {/* Subtle Ambient Dot Grid */}
      <div 
        className="absolute inset-0 pointer-events-none z-0" 
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(circle at center 200px, black, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at center 200px, black, transparent 70%)'
        }}
      />
      <Navbar />

      <main className="pt-32 pb-20 relative z-10">
        <div className="max-w-lg mx-auto px-6">

          {submitted ? (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-8 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-3">
                Received
              </h1>
              <p className="text-zinc-400 font-mono text-sm mb-8">
                Your {type === "bug" ? "bug report" : "feature request"} has been submitted. We&apos;ll review it shortly.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setTitle("");
                  setDescription("");
                  setContactInfo("");
                }}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
              >
                Submit Another
              </button>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-2 text-center">
                Feedback
              </h1>
              <p className="text-zinc-500 font-mono text-xs text-center mb-8">
                Report a bug or request a feature
              </p>

              {/* Type Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setType("bug")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-sm font-bold font-mono text-xs uppercase tracking-widest transition-all ${
                    type === "bug"
                      ? "bg-red-500/10 border border-red-500/30 text-red-400"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Bug size={14} /> Bug Report
                </button>
                <button
                  onClick={() => setType("feature")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-sm font-bold font-mono text-xs uppercase tracking-widest transition-all ${
                    type === "feature"
                      ? "bg-blue-500/10 border border-blue-500/30 text-blue-400"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Lightbulb size={14} /> Feature Request
                </button>
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === "bug" ? "What went wrong?" : "What would you like to see?"}
                  maxLength={200}
                  className="w-full bg-[#0A0A0A] border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={type === "bug" ? "Steps to reproduce, what you expected, what happened..." : "Describe the feature and why it would be useful..."}
                  maxLength={2000}
                  rows={5}
                  className="w-full bg-[#0A0A0A] border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors resize-none"
                />
                <div className="text-right text-[10px] text-zinc-700 font-mono mt-1">
                  {description.length}/2000
                </div>
              </div>

              {/* Contact */}
              <div className="mb-6">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                  Contact <span className="text-zinc-700">(optional)</span>
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Email or Twitter handle for follow-up"
                  className="w-full bg-[#0A0A0A] border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !description.trim()}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-sm uppercase tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                ) : (
                  <><Send size={16} /> Submit {type === "bug" ? "Bug Report" : "Feature Request"}</>
                )}
              </button>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
