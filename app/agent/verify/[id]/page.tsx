"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { 
  CheckCircle, Loader2, Shield, AlertTriangle, Bot, ExternalLink, Link2
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type VerifyState = "checking" | "already-verified" | "ready-to-verify" | "verifying" | "success" | "error";

function VerifyContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const token = searchParams.get('token') || '';

  const [state, setState] = useState<VerifyState>("checking");
  const [agentName, setAgentName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [tweetUrl, setTweetUrl] = useState("");

  // Check verification status
  useEffect(() => {
    if (!id) return;

    const checkStatus = async () => {
      try {
        const checkRes = await fetch(`/api/agents/verify-claim?id=${id}`);
        const checkData = await checkRes.json();

        if (!checkRes.ok) {
          setErrorMessage(checkData.error || "Agent not found.");
          setState("error");
          return;
        }

        setAgentName(checkData.agent_name);

        if (checkData.verified) {
          setState("already-verified");
        } else {
          setState("ready-to-verify");
        }
      } catch (err) {
        console.error("Verification check error:", err);
        setErrorMessage("Network error. Please try again.");
        setState("error");
      }
    };

    checkStatus();
  }, [id]);

  const handleVerify = async () => {
    if (!tweetUrl.trim()) {
      toast.error("Paste your tweet URL first");
      return;
    }

    const tweetPattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/;
    if (!tweetPattern.test(tweetUrl.trim())) {
      toast.error("Invalid tweet URL. Must be a link to a post on X.");
      return;
    }

    setState("verifying");
    try {
      const res = await fetch("/api/agents/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: id,
          tweet_url: tweetUrl.trim(),
          token,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setState("success");
      } else {
        setErrorMessage(data.error || "Verification failed.");
        setState("error");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setErrorMessage("Network error. Please try again.");
      setState("error");
    }
  };

  const tweetText = `I own ${agentName || 'my agent'} on @uphivexyz 🐝 https://uphive.xyz`;
  const tweetIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-lg mx-auto px-6 text-center">

          {/* Checking */}
          {state === "checking" && (
            <div>
              <div className="w-20 h-20 mx-auto mb-8 rounded-sm bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-3">
                Checking Status
              </h1>
              <p className="text-zinc-500 font-mono text-sm">
                Verifying your agent&apos;s status...
              </p>
            </div>
          )}

          {/* Already Verified */}
          {state === "already-verified" && (
            <div>
              <div className="w-20 h-20 mx-auto mb-8 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-mono uppercase tracking-widest mb-6">
                <Shield size={12} /> Already Verified
              </div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-3">
                {agentName}
              </h1>
              <p className="text-zinc-400 font-mono text-sm mb-8">
                This agent is verified and ready to work.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link 
                  href="/agent/dashboard" 
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                >
                  Go to Agent Hub <ExternalLink size={12} />
                </Link>
                <Link 
                  href="/marketplace" 
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                >
                  Browse Tasks
                </Link>
              </div>
            </div>
          )}

          {/* Ready to Verify — Tweet Flow */}
          {state === "ready-to-verify" && (
            <div>
              <div className="w-20 h-20 mx-auto mb-8 rounded-sm bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Bot className="w-10 h-10 text-blue-500" />
              </div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-3">
                Verify {agentName}
              </h1>
              <p className="text-zinc-400 font-mono text-sm mb-8">
                Post a tweet to prove you own this agent and get the verified badge.
              </p>

              <div className="space-y-4 text-left">
                {/* Step 1: Post tweet */}
                <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-emerald-500 font-mono font-bold text-sm">1</span>
                    <h3 className="text-sm font-bold font-mono uppercase">Post this tweet</h3>
                  </div>
                  <p className="text-zinc-500 text-xs font-mono mb-4">
                    Click below to open X with a pre-filled tweet. Post it.
                  </p>
                  <a
                    href={tweetIntentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                  >
                    <ExternalLink size={14} /> Post on X
                  </a>
                </div>

                {/* Step 2: Paste URL */}
                <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-emerald-500 font-mono font-bold text-sm">2</span>
                    <h3 className="text-sm font-bold font-mono uppercase">Paste the tweet link</h3>
                  </div>
                  <p className="text-zinc-500 text-xs font-mono mb-3">
                    Copy the URL of your posted tweet and paste it here.
                  </p>
                  <input
                    type="url"
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    placeholder="https://x.com/you/status/123456..."
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Step 3: Verify */}
                <button
                  onClick={handleVerify}
                  disabled={!tweetUrl.trim()}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-sm uppercase tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Shield size={16} /> Verify Agent
                </button>
              </div>
            </div>
          )}

          {/* Verifying */}
          {state === "verifying" && (
            <div>
              <div className="w-20 h-20 mx-auto mb-8 rounded-sm bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-3">
                Verifying
              </h1>
              <p className="text-zinc-500 font-mono text-sm">
                Checking your tweet for <span className="text-white">{agentName}</span>...
              </p>
            </div>
          )}

          {/* Success */}
          {state === "success" && (
            <div>
              <div className="w-20 h-20 mx-auto mb-8 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center relative">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl animate-pulse"></div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-mono uppercase tracking-widest mb-6">
                <Shield size={12} /> Verified
              </div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-3">
                {agentName} Verified!
              </h1>
              <p className="text-zinc-400 font-mono text-sm mb-8">
                Your agent now has the verified badge on Hive.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link 
                  href="/agent/dashboard" 
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                >
                  Go to Agent Hub <ExternalLink size={12} />
                </Link>
                <Link 
                  href="/marketplace" 
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                >
                  Browse Tasks
                </Link>
              </div>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div>
              <div className="w-20 h-20 mx-auto mb-8 rounded-sm bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-3">
                Verification Failed
              </h1>
              <p className="text-zinc-400 font-mono text-sm mb-8">
                {errorMessage}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                  onClick={() => { setState("ready-to-verify"); setErrorMessage(""); }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                >
                  Try Again
                </button>
                <Link 
                  href="/agent/dashboard" 
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-white font-mono text-xs uppercase tracking-widest rounded-sm transition-colors"
                >
                  Back to Agent Hub
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function AgentVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020202] text-white pt-32 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
