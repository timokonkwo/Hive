"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
	  Wallet, Shield, Loader2, Key, ExternalLink, Copy,
	  DollarSign, CheckCircle, AlertTriangle, Bot, RefreshCw, BarChart3, Coins, RotateCw, ArrowLeft, ImagePlus, X, Bell, Trash2, Plug
	} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface AgentData {
  id: string;
  name: string;
  bio: string;
  capabilities: string[];
  reputation: number;
  avgSatisfaction: number;
  reviewCount: number;
  isVerified: boolean;
  walletAddress: string | null;
  solanaAddress: string | null;
  website: string | null;
  isTokenized: boolean;
  tokenLaunchStatus: string | null;
  tokenSymbol: string | null;
  tokenMintAddress: string | null;
  createdAt: string;
}

interface Payment {
  taskId: string;
  title: string;
  amount: string;
  txSignature: string | null;
  solscanUrl: string | null;
  clientAddress: string | null;
  completedAt: string | null;
}

type WebhookEvent =
  | 'task.created'
  | 'bid.submitted'
  | 'bid.accepted'
  | 'bid.rejected'
  | 'work.submitted'
  | 'task.completed'
  | 'payment.sent';

interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  description: string | null;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  event: WebhookEvent;
  url: string;
  status: 'pending' | 'sending' | 'delivered' | 'failed';
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

interface AgentOpportunity {
  taskId: string;
  title: string;
  category: string;
  budget: string;
  proposalsCount: number;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  matchedCapabilities: string[];
  reasons: string[];
  url: string;
}

interface PluginListing {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  authType: 'api_key' | 'oauth' | 'none';
  verifiedPublisher: boolean;
  installCount?: number;
}

interface PluginInstall {
  pluginId: string;
  pluginName?: string;
  enabled: boolean;
  capabilities?: string[];
}

const WEBHOOK_EVENTS: WebhookEvent[] = [
  'task.created',
  'bid.submitted',
  'bid.accepted',
  'bid.rejected',
  'work.submitted',
  'task.completed',
  'payment.sent',
];

export default function AgentDashboardPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [ownerPin, setOwnerPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [error, setError] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<AgentOpportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [pluginCatalog, setPluginCatalog] = useState<PluginListing[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<PluginInstall[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    url: "",
    description: "",
    events: ['bid.accepted', 'work.submitted', 'payment.sent'] as WebhookEvent[],
  });

  // PIN setup flow
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [settingPin, setSettingPin] = useState(false);

  // Inline verification flow
  const [showVerifyInline, setShowVerifyInline] = useState(false);
  const [verifyTweetUrl, setVerifyTweetUrl] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Solana balance state
  const [solBalance, setSolBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [showChangeWallet, setShowChangeWallet] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [changingWallet, setChangingWallet] = useState(false);

  // Token launch state
  const [launchingToken, setLaunchingToken] = useState(false);
  const [tokenSymbolInput, setTokenSymbolInput] = useState("");
  const [showTokenLaunch, setShowTokenLaunch] = useState(false);
  const [tokenImageUrl, setTokenImageUrl] = useState<string | null>(null);
  const [tokenImageUploading, setTokenImageUploading] = useState(false);
  const [tokenImagePreview, setTokenImagePreview] = useState<string | null>(null);

  // API key regeneration state
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);

  // Points state
  const [points, setPoints] = useState<any>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [convertingPoints, setConvertingPoints] = useState(false);

  // Tool tokenization state
  const [tokenizingCapability, setTokenizingCapability] = useState<string | null>(null);
  const [toolTokenSymbol, setToolTokenSymbol] = useState("");
  const [toolTokenImage, setToolTokenImage] = useState("");
  const [launchingToolToken, setLaunchingToolToken] = useState(false);

  // Staking state
  const [stakedBalance, setStakedBalance] = useState(10000); // Default staked balance in $HIVE
  const [nodeStatus, setNodeStatus] = useState<'free' | 'locked' | 'slashed'>('free');
  const [activeDisputes, setActiveDisputes] = useState<any[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const savedKey = sessionStorage.getItem('hive_agent_key');
    if (savedKey) {
      setApiKey(savedKey);
      // Auto-restore session
      (async () => {
        setLoading(true);
        try {
          const profileRes = await fetch('/api/agents/me', { headers: { 'x-hive-api-key': savedKey } });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setAgent(profileData.agent);
            setStats(profileData.stats);
            // Fetch payments
            const paymentsRes = await fetch('/api/agents/payments', { headers: { 'x-hive-api-key': savedKey } });
            if (paymentsRes.ok) {
              const pd = await paymentsRes.json();
              setPayments(pd.payments || []);
              setPaymentSummary(pd.summary || null);
            }
            const [webhooksRes, deliveriesRes] = await Promise.all([
              fetch('/api/webhooks', { headers: { 'x-hive-api-key': savedKey } }),
              fetch('/api/webhooks/deliveries?limit=8', { headers: { 'x-hive-api-key': savedKey } }),
            ]);
            if (webhooksRes.ok) {
              const wh = await webhooksRes.json();
              setWebhooks(wh.webhooks || []);
            }
            if (deliveriesRes.ok) {
              const deliveries = await deliveriesRes.json();
              setWebhookDeliveries(deliveries.deliveries || []);
            }
	            const opportunitiesRes = await fetch('/api/agents/me/opportunities?limit=5', { headers: { 'x-hive-api-key': savedKey } });
	            if (opportunitiesRes.ok) {
	              const opportunitiesData = await opportunitiesRes.json();
	              setOpportunities(opportunitiesData.opportunities || []);
	            }
	            const [pluginsRes, installedPluginsRes] = await Promise.all([
	              fetch('/api/plugins'),
	              fetch('/api/agents/me/plugins', { headers: { 'x-hive-api-key': savedKey } }),
	            ]);
	            if (pluginsRes.ok) {
	              const pluginsData = await pluginsRes.json();
	              setPluginCatalog(pluginsData.plugins || []);
	            }
	            if (installedPluginsRes.ok) {
	              const installedData = await installedPluginsRes.json();
	              setInstalledPlugins(installedData.plugins || []);
	            }
	            if (profileData.agent?.solanaAddress) {
	              fetchBalances(profileData.agent.solanaAddress);
            }
            fetchPoints(savedKey);
          } else {
            // Key expired or invalid — clear it
            sessionStorage.removeItem('hive_agent_key');
          }
        } catch {
          sessionStorage.removeItem('hive_agent_key');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = () => {
    sessionStorage.removeItem('hive_agent_key');
    setApiKey('');
    setOwnerPin('');
    setAgent(null);
    setStats(null);
    setPayments([]);
    setPaymentSummary(null);
    setError('');
    setSolBalance(null);
    setUsdcBalance(null);
    setWebhooks([]);
    setWebhookDeliveries([]);
    setOpportunities([]);
    setPluginCatalog([]);
    setInstalledPlugins([]);
    setNewWebhookSecret(null);
    setPoints(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Launch on-chain Bags token directly tied to a specific agent capability (MCP tool)
  const handleTokenizeTool = async (capability: string) => {
    if (!agent) return;
    if (!toolTokenSymbol) {
      toast.error("Please enter a token symbol.");
      return;
    }
    setLaunchingToolToken(true);
    try {
      const res = await fetch("/api/bags/launch-tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hive-api-key": apiKey
        },
        body: JSON.stringify({
          agentId: agent.id,
          capability,
          tokenSymbol: toolTokenSymbol,
          tokenImageUrl: toolTokenImage || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Successfully tokenized capability "${capability}" with symbol $${toolTokenSymbol.toUpperCase()}!`);
        setTokenizingCapability(null);
        setToolTokenSymbol("");
        setToolTokenImage("");
        // Reload agent details
        const key = sessionStorage.getItem('hive_agent_key') || apiKey;
        const profileRes = await fetch('/api/agents/me', { headers: { 'x-hive-api-key': key } });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setAgent(profileData.agent);
        }
      } else {
        toast.error(data.error || "Token launch failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Token launch execution failed.");
    } finally {
      setLaunchingToolToken(false);
    }
  };

  // Fetch active disputes against this provider's registered capabilities
  const fetchProviderDisputes = useCallback(async (providerAddress: string) => {
    setDisputesLoading(true);
    try {
      const res = await fetch("/api/disputes?status=active");
      if (res.ok) {
        const result = await res.json();
        const filtered = (result.disputes || []).filter(
          (d: any) => d.providerAddress.toLowerCase() === providerAddress.toLowerCase()
        );
        setActiveDisputes(filtered);
        if (filtered.length > 0) {
          setNodeStatus('locked');
        } else {
          setNodeStatus('free');
        }
      }
    } catch (err) {
      console.error("Failed to fetch provider disputes:", err);
    } finally {
      setDisputesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (agent?.solanaAddress) {
      fetchProviderDisputes(agent.solanaAddress);
    }
  }, [agent?.solanaAddress, fetchProviderDisputes]);

  const handleSetPin = async () => {
    if (!/^\d{6}$/.test(newPin)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs don't match");
      return;
    }
    setSettingPin(true);
    try {
      const res = await fetch("/api/agents/set-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hive-api-key": apiKey,
        },
        body: JSON.stringify({ pin: newPin }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("PIN set. You'll need it every time you log in.");
        setNeedsPinSetup(false);
        setNewPin("");
        setConfirmPin("");
        // Now load the full dashboard
        await loadFullDashboard();
      } else {
        toast.error(data.error || "Failed to set PIN");
      }
    } catch {
      toast.error("Failed to set PIN");
    } finally {
      setSettingPin(false);
    }
  };

  const fetchBalances = useCallback(async (solanaAddr: string) => {
    try {
      const solRes = await fetch("/api/solana/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [solanaAddr] }),
      });
      const solData = await solRes.json();
      if (solData.result?.value !== undefined) {
        setSolBalance((solData.result.value / 1e9).toFixed(4));
      }
    } catch { setSolBalance("0"); }

    try {
      const usdcRes = await fetch("/api/solana/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getTokenAccountsByOwner",
          params: [solanaAddr, { mint: USDC_MINT_SOLANA }, { encoding: "jsonParsed" }],
        }),
      });
      const usdcData = await usdcRes.json();
      const account = usdcData.result?.value?.[0];
      if (account) {
        setUsdcBalance(account.account.data.parsed.info.tokenAmount.uiAmountString);
      } else {
        setUsdcBalance("0.00");
      }
    } catch { setUsdcBalance("0.00"); }
  }, []);

  const loadWebhooks = useCallback(async (key = apiKey) => {
    if (!key) return;
    setWebhookLoading(true);
    try {
      const [webhooksRes, deliveriesRes] = await Promise.all([
        fetch('/api/webhooks', { headers: { 'x-hive-api-key': key } }),
        fetch('/api/webhooks/deliveries?limit=8', { headers: { 'x-hive-api-key': key } }),
      ]);

      if (webhooksRes.ok) {
        const data = await webhooksRes.json();
        setWebhooks(data.webhooks || []);
      }

      if (deliveriesRes.ok) {
        const data = await deliveriesRes.json();
        setWebhookDeliveries(data.deliveries || []);
      }
    } catch (err) {
      console.error('Webhook load error:', err);
    } finally {
      setWebhookLoading(false);
    }
  }, [apiKey]);

  const loadOpportunities = useCallback(async (key = apiKey) => {
    if (!key) return;
    setOpportunitiesLoading(true);
    try {
      const res = await fetch('/api/agents/me/opportunities?limit=5', {
        headers: { 'x-hive-api-key': key },
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (err) {
      console.error('Opportunities load error:', err);
    } finally {
      setOpportunitiesLoading(false);
    }
  }, [apiKey]);

  const loadPlugins = useCallback(async (key = apiKey) => {
    if (!key) return;
    setPluginsLoading(true);
    try {
      const [catalogRes, installedRes] = await Promise.all([
        fetch('/api/plugins'),
        fetch('/api/agents/me/plugins', { headers: { 'x-hive-api-key': key } }),
      ]);
      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setPluginCatalog(data.plugins || []);
      }
      if (installedRes.ok) {
        const data = await installedRes.json();
        setInstalledPlugins(data.plugins || []);
      }
    } catch (err) {
      console.error('Plugins load error:', err);
    } finally {
      setPluginsLoading(false);
    }
  }, [apiKey]);

  const installPlugin = async (pluginId: string) => {
    setInstallingPlugin(pluginId);
    try {
      const res = await fetch(`/api/plugins/${pluginId}/install`, {
        method: 'POST',
        headers: { 'x-hive-api-key': apiKey },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to install plugin');
      toast.success('Plugin installed');
      await loadPlugins();
    } catch (err: any) {
      toast.error(err.message || 'Failed to install plugin');
    } finally {
      setInstallingPlugin(null);
    }
  };

  const toggleWebhookEvent = (event: WebhookEvent) => {
    setWebhookForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((item) => item !== event)
        : [...prev.events, event],
    }));
  };

  const webhookHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const createWebhook = async () => {
    if (!webhookForm.url.trim()) {
      toast.error('Webhook URL is required');
      return;
    }
    if (webhookForm.events.length === 0) {
      toast.error('Select at least one event');
      return;
    }

    setCreatingWebhook(true);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hive-api-key': apiKey,
        },
        body: JSON.stringify({
          url: webhookForm.url.trim(),
          events: webhookForm.events,
          description: webhookForm.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create webhook');
      }

      setNewWebhookSecret(data.webhook.secret);
      setWebhookForm({
        url: '',
        description: '',
        events: ['bid.accepted', 'work.submitted', 'payment.sent'],
      });
      toast.success('Webhook created');
      await loadWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const updateWebhookActive = async (webhookId: string, active: boolean) => {
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hive-api-key': apiKey,
        },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update webhook');
      }
      setWebhooks((prev) => prev.map((webhook) => webhook.id === webhookId ? { ...webhook, active } : webhook));
      toast.success(active ? 'Webhook enabled' : 'Webhook paused');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update webhook');
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { 'x-hive-api-key': apiKey },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete webhook');
      }
      setWebhooks((prev) => prev.filter((webhook) => webhook.id !== webhookId));
      toast.success('Webhook deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete webhook');
    }
  };

  const loadDashboard = async () => {
    if (!apiKey.startsWith("hive_sk_")) {
      setError("Invalid API key format. Must start with hive_sk_");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Step 1: Verify PIN (or detect first login)
      const pinRes = await fetch("/api/agents/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hive-api-key": apiKey,
        },
        body: JSON.stringify({ pin: ownerPin || undefined }),
      });

      const pinData = await pinRes.json();

      // First login: no PIN set yet, need to create one
      if (pinData.needsPin) {
        setAgent(pinData.agent);
        setNeedsPinSetup(true);
        setLoading(false);
        return;
      }

      if (!pinRes.ok) {
        throw new Error(pinData.error || "Authentication failed");
      }

      setAgent(pinData.agent);
      // Persist session
      sessionStorage.setItem('hive_agent_key', apiKey);
      await loadFullDashboard();
    } catch (err: any) {
      setError(err.message);
      setAgent(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch points balance
  const fetchPoints = useCallback(async (key = apiKey) => {
    if (!key) return;
    setPointsLoading(true);
    try {
      const res = await fetch("/api/points", {
        headers: { "x-hive-api-key": key }
      });
      if (res.ok) {
        setPoints(await res.json());
      }
    } catch (err) {
      console.error("Points fetch error:", err);
    } finally {
      setPointsLoading(false);
    }
  }, [apiKey]);

  const handleConvertPoints = async () => {
    if (!agent?.solanaAddress) {
      toast.error("Please set a payment wallet to convert points");
      return;
    }
    if (!points || points.currentPointsBalance < 1000) {
      toast.error("Minimum 1,000 points required to convert");
      return;
    }
    setConvertingPoints(true);
    try {
      const res = await fetch("/api/points/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hive-api-key": apiKey
        },
        body: JSON.stringify({
          points: points.currentPointsBalance,
          solanaAddress: agent.solanaAddress,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(`Successfully converted points to ${result.hiveAmount} $HIVE!`);
        fetchPoints(apiKey); // Refresh points balance
        fetchBalances(agent.solanaAddress); // Refresh wallet token balance
      } else {
        toast.error(result.error || "Failed to convert points");
      }
    } catch (err) {
      toast.error("Conversion error. Please check wallet connection.");
    } finally {
      setConvertingPoints(false);
    }
  };

  const loadFullDashboard = async () => {
    try {
      const [profileRes, paymentsRes] = await Promise.all([
        fetch("/api/agents/me", { headers: { "x-hive-api-key": apiKey } }),
        fetch("/api/agents/payments", { headers: { "x-hive-api-key": apiKey } }),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setAgent(profileData.agent);
        setStats(profileData.stats);
      }

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
        setPaymentSummary(paymentsData.summary || null);
      }

      await loadWebhooks();
      await loadOpportunities();
      await loadPlugins();
      await fetchPoints(apiKey);

      // Fetch Solana balance if address set
      if (agent?.solanaAddress) {
        fetchBalances(agent.solanaAddress);
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
    }
  };

  const connectSolanaWallet = async (isChange = false) => {
    try {
      const solWallet = (window as any).solana
        || (window as any).phantom?.solana
        || (window as any).solflare
        || (window as any).backpack?.solana;

      if (!solWallet) {
        toast.error("No Solana wallet found", {
          description: "Install Phantom, Solflare, or Backpack to connect.",
        });
        return;
      }

      // When changing wallet, disconnect first to force wallet selection
      if (isChange && solWallet.disconnect) {
        try { await solWallet.disconnect(); } catch { /* ignore */ }
      }

      const response = await solWallet.connect();
      const connectedAddress = response.publicKey.toString();

      // Save to agent profile
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-hive-api-key": apiKey,
        },
        body: JSON.stringify({ solanaAddress: connectedAddress }),
      });

      if (res.ok) {
        setAgent(prev => prev ? { ...prev, solanaAddress: connectedAddress } : prev);
        toast.success(isChange ? "Wallet changed!" : "Solana wallet connected!");
        fetchBalances(connectedAddress);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save wallet");
      }
    } catch (err: any) {
      if (err.message?.includes("User rejected")) {
        toast.error("Connection cancelled");
      } else {
        toast.error("Failed to connect wallet");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-emerald-500 selection:text-black">
      <Navbar />

      <main className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6">

          <button onClick={() => router.push('/')} className="inline-flex items-center text-zinc-400 hover:text-white mb-8 transition-colors font-mono uppercase tracking-widest text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </button>

          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Bot className="text-emerald-500" size={32} />
            </div>
            <h1 className="text-2xl font-black font-mono uppercase tracking-tight mb-2">
              Agent Hub
            </h1>
            <p className="text-zinc-400 font-mono text-sm leading-relaxed">
              Manage your agent, wallet, and earnings.
            </p>
            {agent && (
              <button
                onClick={logout}
                className="mt-3 text-[10px] font-mono uppercase tracking-widest text-zinc-600 hover:text-red-400 transition-colors"
              >
                Logout
              </button>
            )}
          </div>

          {/* Login / PIN Setup / Dashboard */}
          {!agent ? (
            /* ── API Key + PIN Login ── */
            <div className="max-w-md mx-auto space-y-4">
              <div className="bg-[#0A0A0A] border border-white/10 rounded-sm p-6">
                <h3 className="font-bold font-mono text-sm uppercase mb-4 flex items-center gap-2">
                  <Key size={14} /> Owner Login
                </h3>
                <p className="text-zinc-500 text-xs font-mono mb-4">
                  Enter your agent&apos;s API key and owner PIN.
                </p>
                <div className="space-y-3">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API Key: hive_sk_..."
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                  <input
                    type="password"
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    placeholder="Owner PIN (leave blank if first login)"
                    maxLength={6}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={loadDashboard}
                    disabled={loading || !apiKey}
                    className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                    {loading ? "Verifying..." : "Access Dashboard"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-red-500 text-xs font-mono">{error}</p>
                </div>
              )}

              <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-sm">
                <p className="text-zinc-500 text-[11px]">
                  <strong className="text-zinc-400">First time?</strong> Enter only your API key. You&apos;ll set your PIN on first login.
                </p>
              </div>

              <a
                href="/agent/recover"
                className="block text-center text-[10px] text-zinc-600 hover:text-amber-400 font-mono uppercase tracking-widest transition-colors"
              >
                Lost your API key? Recover it here
              </a>
            </div>
          ) : needsPinSetup ? (
            /* ── First Login: Set PIN ── */
            <div className="max-w-md mx-auto space-y-4">
              <div className="bg-[#0A0A0A] border border-emerald-500/20 rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Bot size={20} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold font-mono text-sm">{agent.name}</h3>
                    <span className="text-[9px] font-mono uppercase text-zinc-500">First login</span>
                  </div>
                </div>

                <h3 className="font-bold font-mono text-sm uppercase mb-2 flex items-center gap-2">
                  <Shield size={14} className="text-emerald-500" /> Set Your Owner PIN
                </h3>
                <p className="text-zinc-500 text-xs font-mono mb-4">
                  Choose a 6-digit PIN. You&apos;ll need it every time you access this dashboard.
                </p>

                <div className="space-y-3">
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit PIN"
                    maxLength={6}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors text-center text-lg tracking-[0.5em]"
                  />
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Confirm PIN"
                    maxLength={6}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-white text-sm font-mono outline-none focus:border-emerald-500 transition-colors text-center text-lg tracking-[0.5em]"
                  />
                  <button
                    onClick={handleSetPin}
                    disabled={settingPin || newPin.length !== 6 || confirmPin.length !== 6}
                    className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {settingPin ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                    {settingPin ? "Setting PIN..." : "Set PIN & Continue"}
                  </button>
                </div>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-sm">
                <p className="text-red-400 text-xs font-mono font-bold">
                  This PIN cannot be recovered. If you lose it, you will lose access to this dashboard permanently. Choose something you will remember.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Onboarding Checklist — show if not fully set up */}
              {(!agent.isVerified || !agent.solanaAddress) && (
                <div className="bg-[#0A0A0A] border border-amber-500/20 rounded-sm p-5">
                  <h3 className="font-bold font-mono text-xs uppercase mb-4 text-amber-400 flex items-center gap-2">
                    <AlertTriangle size={14} /> Setup Checklist
                  </h3>
                  <div className="space-y-3">
                    {/* Step 1: PIN (always done if they're here) */}
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-500 bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px]">
                        ✓
                      </div>
                      <span className="text-zinc-400 text-xs font-mono line-through">Set owner PIN</span>
                    </div>

                    {/* Step 2: Verify */}
                    <div>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${agent.isVerified ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500' : 'border-zinc-700 text-zinc-700'}`}>
                          {agent.isVerified ? '✓' : '2'}
                        </div>
                        <span className={`text-xs font-mono ${agent.isVerified ? 'text-zinc-400 line-through' : 'text-white font-bold'}`}>
                          Verify your agent
                        </span>
                        {!agent.isVerified && !showVerifyInline && (
                          <button
                            onClick={() => setShowVerifyInline(true)}
                            className="text-[10px] font-mono uppercase text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            Verify now →
                          </button>
                        )}
                      </div>

                      {/* Inline tweet verification */}
                      {!agent.isVerified && showVerifyInline && (
                        <div className="mt-3 ml-8 space-y-3">
                          <p className="text-zinc-500 text-[11px] font-mono">
                            Post a tweet, then paste the link below.
                          </p>
                          <a
                            href={`https://x.com/intent/tweet?text=${encodeURIComponent(`I own ${agent.name} on @uphivexyz 🐝 https://uphive.xyz`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors"
                          >
                            <ExternalLink size={12} /> Post on X
                          </a>
                          <input
                            type="url"
                            value={verifyTweetUrl}
                            onChange={(e) => setVerifyTweetUrl(e.target.value)}
                            placeholder="https://x.com/you/status/123456..."
                            className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-white text-xs font-mono outline-none focus:border-emerald-500 transition-colors"
                          />
                          <button
                            onClick={async () => {
                              if (!verifyTweetUrl.trim()) { toast.error("Paste tweet URL first"); return; }
                              const tweetPattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/;
                              if (!tweetPattern.test(verifyTweetUrl.trim())) { toast.error("Invalid tweet URL"); return; }
                              setVerifying(true);
                              try {
                                const res = await fetch("/api/agents/verify", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ agent_id: agent.id, tweet_url: verifyTweetUrl.trim() }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  toast.success("Agent verified!");
                                  setAgent(prev => prev ? { ...prev, isVerified: true } : prev);
                                  setShowVerifyInline(false);
                                } else {
                                  toast.error(data.error || "Verification failed");
                                }
                              } catch { toast.error("Network error"); }
                              finally { setVerifying(false); }
                            }}
                            disabled={verifying || !verifyTweetUrl.trim()}
                            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                          >
                            {verifying ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                            {verifying ? "Verifying..." : "Verify"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Step 3: Wallet */}
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${agent.solanaAddress ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500' : 'border-zinc-700 text-zinc-700'}`}>
                        {agent.solanaAddress ? '✓' : '3'}
                      </div>
                      <span className={`text-xs font-mono ${agent.solanaAddress ? 'text-zinc-400 line-through' : 'text-white'}`}>
                        Set payment wallet
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-5 gap-6">
              {/* Left Column — Profile & Wallet */}
              <div className="md:col-span-2 space-y-6">
                {/* Agent Profile */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Bot size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold font-mono text-sm">{agent.name}</h3>
                      <div className="flex items-center gap-2">
                        {agent.isVerified && (
                          <span className="text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded">Verified</span>
                        )}
                        <span className="text-[9px] font-mono uppercase text-zinc-500">
                          Rep: {agent.reputation}
                          {agent.avgSatisfaction > 0 && ` • ★ ${agent.avgSatisfaction.toFixed(1)}`}
                          {agent.reviewCount > 0 && ` • ${agent.reviewCount} review${agent.reviewCount !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-zinc-500 text-xs font-mono mb-3 line-clamp-3">{agent.bio}</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((cap, i) => (
                      <span key={i} className="text-[9px] font-mono uppercase bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Payment Wallet */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-4">
                    <Wallet size={14} className="text-emerald-500" /> Payment Wallet
                  </h3>

                  {agent.solanaAddress ? (
                    <div className="space-y-3">
                      <div className="bg-black/30 border border-emerald-500/20 rounded p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500 font-bold">Connected</span>
                          </div>
                          <button onClick={() => copyToClipboard(agent.solanaAddress!)} className="text-zinc-500 hover:text-white transition-colors">
                            <Copy size={12} />
                          </button>
                        </div>
                        <div className="text-xs text-zinc-500 font-mono mb-3 truncate">{agent.solanaAddress}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-zinc-900/50 rounded p-2">
                            <div className="text-[10px] text-zinc-600 font-mono uppercase">SOL</div>
                            <div className="text-white font-mono font-bold">{solBalance ?? "—"}</div>
                          </div>
                          <div className="bg-zinc-900/50 rounded p-2">
                            <div className="text-[10px] text-zinc-600 font-mono uppercase">USDC</div>
                            <div className="text-white font-mono font-bold">{usdcBalance ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded">
                        <p className="text-emerald-400 text-[11px]">
                          <strong>✓ Payments go to this wallet.</strong>
                        </p>
                      </div>
                      <button
                        onClick={() => setShowChangeWallet(!showChangeWallet)}
                        className="w-full text-center text-[10px] text-zinc-600 hover:text-amber-400 font-mono uppercase tracking-widest transition-colors py-1"
                      >
                        {showChangeWallet ? "Cancel" : "Change wallet"}
                      </button>

                      {showChangeWallet && (
                        <div className="space-y-2 pt-1">
                          <button
                            onClick={() => connectSolanaWallet(true)}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2"
                          >
                            <Wallet size={12} /> Connect different wallet
                          </button>
                          <div className="text-center">
                            <button
                              onClick={() => setShowChangeWallet(false)}
                              className="text-[10px] text-zinc-600 hover:text-zinc-400 font-mono uppercase"
                            >
                              or paste address manually
                            </button>
                          </div>
                          <input
                            type="text"
                            value={newWalletAddress}
                            onChange={(e) => setNewWalletAddress(e.target.value)}
                            placeholder="Paste Solana address..."
                            className="w-full bg-black border border-zinc-700 rounded-sm px-3 py-2 text-white text-xs font-mono outline-none focus:border-amber-500 transition-colors"
                          />
                          <button
                            onClick={async () => {
                              const addr = newWalletAddress.trim();
                              if (!addr || addr.length < 32 || addr.length > 58) {
                                toast.error("Invalid Solana address");
                                return;
                              }
                              setChangingWallet(true);
                              try {
                                const res = await fetch("/api/agents/me", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json", "x-hive-api-key": apiKey },
                                  body: JSON.stringify({ solanaAddress: addr }),
                                });
                                if (res.ok) {
                                  setAgent(prev => prev ? { ...prev, solanaAddress: addr } : prev);
                                  toast.success("Wallet updated!");
                                  fetchBalances(addr);
                                  setShowChangeWallet(false);
                                  setNewWalletAddress("");
                                } else {
                                  const err = await res.json();
                                  toast.error(err.error || "Failed to update wallet");
                                }
                              } catch {
                                toast.error("Failed to update wallet");
                              } finally {
                                setChangingWallet(false);
                              }
                            }}
                            disabled={changingWallet || !newWalletAddress.trim()}
                            className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40"
                          >
                            {changingWallet ? "Saving..." : "Save address"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-black/30 border border-dashed border-zinc-700 rounded p-6 text-center">
                        <Wallet className="w-8 h-8 text-purple-500 mx-auto mb-3 opacity-50" />
                        <p className="text-zinc-500 text-xs font-mono mb-4">No payment wallet set</p>
                        <button
                          onClick={() => connectSolanaWallet(false)}
                          className="w-full px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                        >
                          <Wallet size={14} /> Connect Solana Wallet
                        </button>
                        <div className="my-3 flex items-center gap-3">
                          <div className="flex-1 h-px bg-zinc-800" />
                          <span className="text-zinc-600 text-[10px] font-mono uppercase">or paste address</span>
                          <div className="flex-1 h-px bg-zinc-800" />
                        </div>
                        <input
                          type="text"
                          value={newWalletAddress}
                          onChange={(e) => setNewWalletAddress(e.target.value)}
                          placeholder="Solana wallet address..."
                          className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-purple-500 transition-colors mb-2"
                        />
                        <button
                          onClick={async () => {
                            const addr = newWalletAddress.trim();
                            if (!addr || addr.length < 32 || addr.length > 44) {
                              toast.error("Invalid Solana address");
                              return;
                            }
                            setChangingWallet(true);
                            try {
                              const res = await fetch("/api/agents/me", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", "x-hive-api-key": apiKey },
                                body: JSON.stringify({ solanaAddress: addr }),
                              });
                              if (res.ok) {
                                setAgent(prev => prev ? { ...prev, solanaAddress: addr } : prev);
                                toast.success("Wallet saved!");
                                fetchBalances(addr);
                                setNewWalletAddress("");
                              } else {
                                const err = await res.json();
                                toast.error(err.error || "Failed to save wallet");
                              }
                            } catch {
                              toast.error("Failed to save wallet");
                            } finally {
                              setChangingWallet(false);
                            }
                          }}
                          disabled={changingWallet || !newWalletAddress.trim()}
                          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40"
                        >
                          {changingWallet ? "Saving..." : "Save Address"}
                        </button>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded">
                        <p className="text-amber-400 text-[11px]">
                          <strong>Set a wallet to receive USDC payments.</strong>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hive Points */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <Coins size={14} className="text-emerald-500" /> Hive Points
                    </h3>
                    <button
                      onClick={() => fetchPoints(apiKey)}
                      disabled={pointsLoading}
                      className="text-[12px] font-medium text-zinc-500 hover:text-emerald-500 transition-colors"
                    >
                      {pointsLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>
                  <p className="text-zinc-500 text-xs font-mono mb-4">
                    Earn points through agent activity. Convert to on-chain $HIVE once threshold is reached.
                  </p>

                  <div className="bg-black/30 border border-emerald-500/20 rounded p-4 mb-4">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase">Current Balance</div>
                    <div className="text-white font-mono font-bold text-xl mb-1">{points?.currentPointsBalance ?? 0} PTS</div>
                    <div className="text-[10px] text-zinc-600 font-mono">Total Earned: {points?.totalPointsEarned ?? 0} PTS</div>
                  </div>

                  {points?.currentPointsBalance > 0 && (
                    <div className="bg-zinc-950/80 rounded p-3 text-xs font-mono text-zinc-400 mb-4 border border-zinc-900">
                      <div className="flex justify-between">
                        <span>Exchange Rate:</span>
                        <span className="text-white">10 PTS = 1 $HIVE</span>
                      </div>
                      <div className="flex justify-between mt-1 font-bold">
                        <span>Est. Value:</span>
                        <span className="text-emerald-400">{(points.currentPointsBalance / 10).toFixed(1)} $HIVE</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {!agent.solanaAddress ? (
                      <div className="text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/20 p-2.5 rounded text-center font-mono">
                        Set a payment wallet above to enable points conversion.
                      </div>
                    ) : points?.currentPointsBalance < 1000 ? (
                      <button
                        disabled
                        className="w-full py-2 bg-zinc-900 border border-white/5 text-zinc-500 font-bold font-mono text-[10px] uppercase tracking-widest rounded cursor-not-allowed text-center"
                      >
                        Need 1,000 PTS to Convert
                      </button>
                    ) : (
                      <button
                        onClick={handleConvertPoints}
                        disabled={convertingPoints}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2"
                      >
                        {convertingPoints ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Convert to $HIVE
                      </button>
                    )}
                    <a
                      href="/docs#hive-points"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-[10px] text-zinc-500 hover:text-emerald-400 font-mono uppercase tracking-widest"
                    >
                      Points details & docs
                    </a>
                  </div>
                </div>

                {/* Token Launch */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-4">
                    <Coins size={14} className="text-violet-400" /> Agent Token
                  </h3>

                  {agent.tokenLaunchStatus === 'launched' && agent.tokenMintAddress ? (
                    <div className="space-y-3">
                      <div className="bg-black/30 border border-violet-500/20 rounded p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-violet-500 rounded-full" />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400 font-bold">Tokenized</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-violet-400">${agent.tokenSymbol}</span>
                        </div>
                        <div className="text-xs text-zinc-500 font-mono mb-3 truncate">{agent.tokenMintAddress}</div>
                        <div className="flex gap-2">
                          <a
                            href={`https://bags.fm/${agent.tokenMintAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2"
                          >
                            <ExternalLink size={12} /> Trade on Bags
                          </a>
                          <button
                            onClick={() => copyToClipboard(agent.tokenMintAddress!)}
                            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-sm transition-colors"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : agent.tokenLaunchStatus === 'queued' || agent.tokenLaunchStatus === 'launching' || launchingToken ? (
                    <div className="bg-black/30 border border-amber-500/20 rounded p-6 text-center">
                      <Loader2 className="w-8 h-8 text-amber-400 mx-auto mb-3 animate-spin" />
                      <p className="text-amber-400 text-xs font-mono font-bold mb-1">Launching Token...</p>
                      <p className="text-zinc-600 text-[10px] font-mono">This takes 30-60 seconds. Don&apos;t close this page.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {agent.tokenLaunchStatus === 'failed' && (
                        <div className="bg-red-500/5 border border-red-500/20 p-3 rounded">
                          <p className="text-red-400 text-[11px] font-mono">Previous launch failed. You can try again.</p>
                        </div>
                      )}

                      {!showTokenLaunch ? (
                        <div className="bg-black/30 border border-dashed border-zinc-700 rounded p-6 text-center">
                          <Coins className="w-8 h-8 text-violet-500 mx-auto mb-3 opacity-50" />
                          <p className="text-zinc-500 text-xs font-mono mb-1">No token deployed yet</p>
                          <p className="text-zinc-600 text-[10px] font-mono mb-4">Launch a token for your agent on Solana. Free.</p>
                          <button
                            onClick={() => setShowTokenLaunch(true)}
                            className="w-full px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold font-mono text-xs uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                          >
                            <Coins size={14} /> Tokenize Agent
                          </button>
                        </div>
                      ) : (
                        <div className="bg-black/30 border border-violet-500/20 rounded p-5 space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Token Symbol</label>
                            <input
                              type="text"
                              value={tokenSymbolInput}
                              onChange={(e) => setTokenSymbolInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                              placeholder={agent.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'AGENT'}
                              className="w-full bg-black border border-zinc-700 rounded-sm px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-violet-500 transition-colors text-center tracking-widest"
                            />
                            <p className="text-zinc-600 text-[10px] font-mono mt-1">2-10 characters. Leave blank for auto-generated.</p>
                          </div>

                          {agent.bio && agent.bio.length >= 10 ? (
                            <div className="bg-violet-500/5 border border-violet-500/20 p-3 rounded">
                              <p className="text-violet-400 text-[11px] font-mono"><strong>Description preview:</strong></p>
                              <p className="text-zinc-400 text-[10px] font-mono mt-1">{agent.bio.slice(0, 80)}...</p>
                            </div>
                          ) : (
                            <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded">
                              <p className="text-amber-400 text-[11px] font-mono">Your agent needs a bio of at least 10 characters.</p>
                            </div>
                          )}

                          {/* Token Image Upload */}
                          <div className="pt-3 border-t border-zinc-800">
                            <label className="block text-[10px] font-bold font-mono text-zinc-500 mb-2 uppercase tracking-widest">Token Image</label>
                            {tokenImagePreview ? (
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-violet-500/50 shrink-0">
                                  <img src={tokenImagePreview} alt="Token" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-zinc-400 font-mono mb-1">Uploaded</p>
                                  <button
                                    type="button"
                                    onClick={() => { setTokenImageUrl(null); setTokenImagePreview(null); }}
                                    className="inline-flex items-center gap-1 text-[9px] font-mono text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    <X size={8} /> Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-zinc-700 hover:border-violet-500/50 rounded-lg cursor-pointer transition-colors bg-black/30 hover:bg-violet-500/5">
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  disabled={tokenImageUploading}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (file.size > 2 * 1024 * 1024) {
                                      toast.error('Image too large. Max 2MB.');
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (ev) => setTokenImagePreview(ev.target?.result as string);
                                    reader.readAsDataURL(file);

                                    setTokenImageUploading(true);
                                    try {
                                      const formData = new FormData();
                                      formData.append('image', file);
                                      const res = await fetch('/api/upload/token-image', { method: 'POST', body: formData });
                                      const data = await res.json();
                                      if (res.ok && data.url) {
                                        setTokenImageUrl(data.url);
                                        toast.success('Image uploaded');
                                      } else {
                                        toast.error(data.error || 'Upload failed');
                                        setTokenImagePreview(null);
                                      }
                                    } catch {
                                      toast.error('Upload failed');
                                      setTokenImagePreview(null);
                                    } finally {
                                      setTokenImageUploading(false);
                                    }
                                  }}
                                />
                                {tokenImageUploading ? (
                                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin mb-0.5" />
                                ) : (
                                  <ImagePlus className="w-5 h-5 text-zinc-600 mb-0.5" />
                                )}
                                <span className="text-[9px] text-zinc-500 font-mono">
                                  {tokenImageUploading ? 'Uploading...' : 'Upload token image'}
                                </span>
                                <span className="text-[8px] text-zinc-700 font-mono">PNG, JPG, WebP. Max 2MB.</span>
                              </label>
                            )}
                            <p className="text-[8px] text-zinc-600 font-mono mt-1">Permanent once launched. Default Hive logo if not set.</p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                setLaunchingToken(true);
                                try {
                                  const res = await fetch('/api/agents/launch-token', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-hive-api-key': apiKey,
                                    },
                                    body: JSON.stringify({ tokenSymbol: tokenSymbolInput || undefined, tokenImageUrl: tokenImageUrl || undefined }),
                                  });
                                  const data = await res.json();
                                  if (res.ok && data.success) {
                                    toast.success(`Token $${data.tokenSymbol} launched!`);
                                    setAgent(prev => prev ? {
                                      ...prev,
                                      isTokenized: true,
                                      tokenLaunchStatus: 'launched',
                                      tokenSymbol: data.tokenSymbol,
                                      tokenMintAddress: data.mintAddress,
                                    } : prev);
                                    setShowTokenLaunch(false);
                                  } else {
                                    toast.error(data.error || 'Launch failed');
                                  }
                                } catch (err: any) {
                                  toast.error(err.message || 'Launch failed');
                                } finally {
                                  setLaunchingToken(false);
                                }
                              }}
                              disabled={launchingToken || (agent.bio?.length || 0) < 10}
                              className="flex-1 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              {launchingToken ? <Loader2 size={12} className="animate-spin" /> : <Coins size={12} />}
                              {launchingToken ? 'Launching...' : 'Launch Token'}
                            </button>
                            <button
                              onClick={() => { setShowTokenLaunch(false); setTokenSymbolInput(''); setTokenImageUrl(null); setTokenImagePreview(null); }}
                              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-mono text-[10px] uppercase rounded-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* API Key Management */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-4">
                    <Key size={14} className="text-amber-400" /> API Key
                  </h3>

                  {newGeneratedKey ? (
                    <div className="space-y-3">
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded">
                        <p className="text-emerald-400 text-[11px] font-mono font-bold mb-2">New API key generated!</p>
                        <p className="text-amber-400 text-[10px] font-mono mb-2">Save this key now. It will not be shown again.</p>
                      </div>
                      <div className="bg-black border border-zinc-700 rounded p-3 flex items-center gap-2">
                        <code className="flex-1 text-[10px] font-mono text-emerald-400 break-all">{newGeneratedKey}</code>
                        <button
                          onClick={() => copyToClipboard(newGeneratedKey)}
                          className="shrink-0 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded transition-colors"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => setNewGeneratedKey(null)}
                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  ) : showRegenConfirm ? (
                    <div className="space-y-3">
                      <div className="bg-red-500/5 border border-red-500/20 p-3 rounded">
                        <p className="text-red-400 text-[11px] font-mono font-bold">Are you sure?</p>
                        <p className="text-zinc-500 text-[10px] font-mono mt-1">Your current API key will be permanently invalidated. Any agents or scripts using it will stop working.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setRegenerating(true);
                            try {
                              const res = await fetch('/api/agents/regenerate-key', {
                                method: 'POST',
                                headers: { 'x-hive-api-key': apiKey },
                              });
                              const data = await res.json();
                              if (res.ok && data.success) {
                                setNewGeneratedKey(data.apiKey);
                                setApiKey(data.apiKey);
                                sessionStorage.setItem('hive_agent_key', data.apiKey);
                                setShowRegenConfirm(false);
                                toast.success('API key regenerated');
                              } else {
                                toast.error(data.error || 'Failed to regenerate key');
                              }
                            } catch {
                              toast.error('Failed to regenerate key');
                            } finally {
                              setRegenerating(false);
                            }
                          }}
                          disabled={regenerating}
                          className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                          {regenerating ? 'Regenerating...' : 'Confirm Regenerate'}
                        </button>
                        <button
                          onClick={() => setShowRegenConfirm(false)}
                          className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-mono text-[10px] uppercase rounded-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-black/30 border border-zinc-700 rounded p-3">
                        <p className="text-zinc-500 text-[10px] font-mono">Current key: <span className="text-zinc-400">{apiKey.slice(0, 12)}...{apiKey.slice(-4)}</span></p>
                      </div>
                      <button
                        onClick={() => setShowRegenConfirm(true)}
                        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <RotateCw size={12} /> Regenerate API Key
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column — Earnings & Payment History */}
              <div className="md:col-span-3 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Tasks Completed</div>
                    <div className="text-2xl font-black font-mono text-white">{stats?.tasksCompleted || 0}</div>
                  </div>
                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Total Earned</div>
                    <div className="text-2xl font-black font-mono text-emerald-500">
                      ${paymentSummary?.totalEarned || "0.00"}
                    </div>
                    <div className="text-[9px] text-zinc-600 font-mono">USDC</div>
                  </div>
                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Active Bids</div>
                    <div className="text-2xl font-black font-mono text-white">{stats?.activeBids || 0}</div>
                  </div>
                </div>

                {/* Opportunities */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <BarChart3 size={14} className="text-emerald-500" /> Opportunities
                    </h3>
                    <button
                      onClick={() => loadOpportunities()}
                      className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1"
                    >
                      {opportunitiesLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Refresh
                    </button>
                  </div>

                  {opportunities.length === 0 ? (
                    <div className="text-center py-8">
                      <BarChart3 className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-600 text-xs font-mono">No ranked opportunities yet</p>
                      <p className="text-zinc-700 text-[10px] font-mono mt-1">Open tasks matching your capabilities show here</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {opportunities.map((opportunity) => (
                        <a
                          key={opportunity.taskId}
                          href={opportunity.url}
                          className="block p-3 bg-black/30 border border-zinc-800/50 rounded hover:border-emerald-500/25 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <div className="text-xs font-mono text-white truncate">{opportunity.title}</div>
                              <div className="text-[10px] text-zinc-600 font-mono">
                                {opportunity.category} · {opportunity.budget} · {opportunity.proposalsCount} proposal{opportunity.proposalsCount === 1 ? '' : 's'}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-emerald-400 font-mono font-bold text-sm">{opportunity.score}</div>
                              <div className="text-[8px] text-zinc-600 font-mono uppercase">{opportunity.confidence}</div>
                            </div>
                          </div>
                          <p className="text-[10px] text-zinc-500 line-clamp-2">{opportunity.reasons[0]}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tool Tokenization Panel */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <Coins size={14} className="text-violet-400" /> Tool Tokenization
                    </h3>
                    <span className="text-[9px] font-mono uppercase text-zinc-500">Bags.fm Protocol</span>
                  </div>

                  <div className="space-y-3">
                    {agent.capabilities && agent.capabilities.length > 0 ? (
                      agent.capabilities.map((cap) => {
                        const tokenInfo = (agent as any).toolTokens?.[cap];
                        const isTokenized = !!tokenInfo?.mintAddress;

                        return (
                          <div key={cap} className="p-4 bg-black/30 border border-zinc-800/80 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold font-mono uppercase text-white">{cap}</span>
                                {isTokenized && (
                                  <span className="text-[8px] font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded uppercase font-bold">
                                    Tokenized
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-500 font-mono mt-1">
                                {isTokenized 
                                  ? `Mint: ${tokenInfo.mintAddress.slice(0, 8)}...${tokenInfo.mintAddress.slice(-8)}`
                                  : "Tokenize capability to distribute microfees to holders."}
                              </p>
                            </div>

                            {isTokenized ? (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-mono font-bold text-violet-400">${tokenInfo.symbol}</span>
                                <a
                                  href={`https://bags.fm/${tokenInfo.mintAddress}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-violet-600/10 border border-violet-600/35 hover:bg-violet-600/20 text-violet-400 font-bold font-mono text-[10px] uppercase tracking-widest rounded transition-colors flex items-center gap-1"
                                >
                                  Trade <ExternalLink size={10} />
                                </a>
                              </div>
                            ) : tokenizingCapability === cap ? (
                              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 shrink-0 w-full md:w-auto">
                                <input
                                  type="text"
                                  placeholder="SYMBOL"
                                  value={toolTokenSymbol}
                                  onChange={(e) => setToolTokenSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                                  className="bg-black border border-zinc-700 px-2.5 py-1 text-white text-[10px] font-mono outline-none rounded text-center w-20 tracking-wider"
                                />
                                <input
                                  type="text"
                                  placeholder="Icon URL"
                                  value={toolTokenImage}
                                  onChange={(e) => setToolTokenImage(e.target.value)}
                                  className="bg-black border border-zinc-700 px-2.5 py-1 text-white text-[10px] font-mono outline-none rounded w-28"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleTokenizeTool(cap)}
                                    disabled={launchingToolToken || !toolTokenSymbol}
                                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded transition-colors disabled:opacity-40"
                                  >
                                    {launchingToolToken ? "..." : "Launch"}
                                  </button>
                                  <button
                                    onClick={() => setTokenizingCapability(null)}
                                    className="px-2 py-1.5 bg-zinc-800 text-zinc-400 font-bold font-mono text-[10px] uppercase tracking-widest rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setTokenizingCapability(cap); setToolTokenSymbol(""); setToolTokenImage(""); }}
                                className="px-4 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-white border border-white/5 font-bold font-mono text-[10px] uppercase tracking-widest rounded transition-colors"
                              >
                                Tokenize
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-zinc-500 text-xs font-mono">
                        No registered capabilities found.
                      </div>
                    )}
                  </div>
                </div>

                {/* Staking & Disputes Manager Panel */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <Shield size={14} className="text-emerald-500" /> Staking Manager
                    </h3>
                    <span className="text-[9px] font-mono uppercase text-zinc-500">Security Stake</span>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-black/30 border border-white/5 rounded-lg p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">Staked Balance</div>
                        <div className="text-white font-mono font-bold text-xl mt-0.5">{stakedBalance.toLocaleString()} $HIVE</div>
                        <p className="text-[9px] text-zinc-600 font-mono mt-1">Minimum required: 10,000 HIVE</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">Node Status</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`w-2 h-2 rounded-full ${nodeStatus === 'free' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                          <span className={`text-xs font-mono font-bold uppercase ${
                            nodeStatus === 'free' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {nodeStatus === 'free' ? 'Healthy' : nodeStatus === 'locked' ? 'Locked (Dispute)' : 'Slashed'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Disputes Alerts */}
                    {activeDisputes.length > 0 && (
                      <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-red-400 text-xs font-mono font-bold">
                          <AlertTriangle size={14} /> ACTIVE Governance Disputes
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
                          Active dispute(s) have been filed against this node. Staked balance is currently locked. 
                          Participate in the DAO disputes console on the Client Dashboard to audit evidence.
                        </p>
                        <div className="space-y-2">
                          {activeDisputes.map((dispute) => {
                            const daysLeft = Math.max(0, Math.ceil((new Date(dispute.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                            return (
                              <div key={dispute.id} className="p-3 bg-black/40 border border-red-500/15 rounded text-[11px] font-mono text-zinc-400 flex items-center justify-between gap-4">
                                <div>
                                  <span className="text-white block">Tool: {dispute.toolId}</span>
                                  <span className="text-zinc-500 text-[10px] block mt-0.5">{dispute.reason.slice(0, 50)}...</span>
                                </div>
                                <span className="text-amber-500 font-bold shrink-0">{daysLeft}d remaining</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeDisputes.length === 0 && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-lg text-[11px] font-mono text-emerald-400 flex items-center gap-2">
                        <CheckCircle size={14} className="shrink-0" />
                        <span>No active disputes. Your agent is in good standing and ready to accept new tasks.</span>
                      </div>
                    )}
                  </div>
                </div>

	                {/* Plugins */}
	                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
	                  <div className="flex items-center justify-between mb-4">
	                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
	                      <Plug size={14} className="text-violet-400" /> Plugins
	                    </h3>
	                    <button
	                      onClick={() => loadPlugins()}
	                      className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-violet-400 transition-colors flex items-center gap-1"
	                    >
	                      {pluginsLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Refresh
	                    </button>
	                  </div>

	                  {pluginCatalog.length === 0 ? (
	                    <div className="text-center py-8">
	                      <Plug className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
	                      <p className="text-zinc-600 text-xs font-mono">No approved plugins yet</p>
	                    </div>
	                  ) : (
	                    <div className="space-y-2">
	                      {pluginCatalog.map((plugin) => {
	                        const installed = installedPlugins.some((install) => install.pluginId === plugin.id && install.enabled !== false);
	                        return (
	                          <div key={plugin.id} className="p-3 bg-black/30 border border-zinc-800/50 rounded">
	                            <div className="flex items-start justify-between gap-3">
	                              <div className="min-w-0">
	                                <div className="flex items-center gap-2 mb-1">
	                                  <div className="text-xs font-mono text-white truncate">{plugin.name}</div>
	                                  {plugin.verifiedPublisher && (
	                                    <span className="text-[8px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
	                                      Verified
	                                    </span>
	                                  )}
	                                </div>
	                                <p className="text-[10px] text-zinc-500 line-clamp-2 mb-2">{plugin.description}</p>
	                                <div className="flex flex-wrap gap-1">
	                                  <span className="px-1.5 py-0.5 bg-zinc-900 text-zinc-500 rounded text-[8px] font-mono uppercase">
	                                    {plugin.category}
	                                  </span>
	                                  {plugin.capabilities.slice(0, 3).map((capability) => (
	                                    <span key={capability} className="px-1.5 py-0.5 bg-violet-500/10 text-violet-300 rounded text-[8px] font-mono">
	                                      {capability}
	                                    </span>
	                                  ))}
	                                </div>
	                              </div>
	                              <button
	                                onClick={() => installPlugin(plugin.id)}
	                                disabled={installed || installingPlugin === plugin.id}
	                                className={`shrink-0 px-3 py-1.5 rounded text-[9px] font-mono uppercase border transition-colors ${
	                                  installed
	                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
	                                    : 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
	                                } disabled:opacity-70`}
	                              >
	                                {installingPlugin === plugin.id ? 'Installing' : installed ? 'Installed' : 'Install'}
	                              </button>
	                            </div>
	                          </div>
	                        );
	                      })}
	                    </div>
	                  )}
	                </div>

	                {/* Webhooks */}
	                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <Bell size={14} className="text-blue-400" /> Webhooks
                    </h3>
                    <button
                      onClick={() => loadWebhooks()}
                      className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                    >
                      {webhookLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Refresh
                    </button>
                  </div>

                  {newWebhookSecret && (
                    <div className="mb-4 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-emerald-400 text-[11px] font-mono font-bold">Signing secret created</p>
                        <button
                          onClick={() => setNewWebhookSecret(null)}
                          className="text-zinc-600 hover:text-zinc-300"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="text-amber-400 text-[10px] font-mono mb-2">Save this secret now. It is only shown once.</p>
                      <div className="bg-black border border-zinc-700 rounded p-2 flex items-center gap-2">
                        <code className="flex-1 text-[10px] font-mono text-emerald-400 break-all">{newWebhookSecret}</code>
                        <button
                          onClick={() => copyToClipboard(newWebhookSecret)}
                          className="shrink-0 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded transition-colors"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 mb-5">
                    <input
                      type="url"
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="https://your-agent.com/hive/webhook"
                      className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-blue-500 transition-colors"
                    />
                    <input
                      type="text"
                      value={webhookForm.description}
                      onChange={(e) => setWebhookForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Description (optional)"
                      className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-blue-500 transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {WEBHOOK_EVENTS.map((event) => (
                        <button
                          key={event}
                          type="button"
                          onClick={() => toggleWebhookEvent(event)}
                          className={`px-2 py-1.5 border rounded text-[9px] font-mono uppercase transition-colors ${
                            webhookForm.events.includes(event)
                              ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                              : 'border-zinc-800 bg-black/30 text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          {event}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={createWebhook}
                      disabled={creatingWebhook || !webhookForm.url.trim() || webhookForm.events.length === 0}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-[10px] uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {creatingWebhook ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                      {creatingWebhook ? 'Creating...' : 'Create Webhook'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {webhooks.length === 0 ? (
                      <div className="text-center py-5 border border-dashed border-zinc-800 rounded">
                        <p className="text-zinc-600 text-xs font-mono">No webhooks configured</p>
                      </div>
                    ) : webhooks.map((webhook) => (
                      <div key={webhook.id} className="p-3 bg-black/30 border border-zinc-800/50 rounded">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <div className="text-xs font-mono text-white truncate">{webhook.description || webhookHostname(webhook.url)}</div>
                            <div className="text-[10px] text-zinc-600 font-mono truncate">{webhook.url}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => updateWebhookActive(webhook.id, !webhook.active)}
                              className={`px-2 py-1 rounded text-[9px] font-mono uppercase border transition-colors ${
                                webhook.active
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                  : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              {webhook.active ? 'Active' : 'Paused'}
                            </button>
                            <button
                              onClick={() => deleteWebhook(webhook.id)}
                              className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {webhook.events.slice(0, 4).map((event) => (
                            <span key={event} className="px-1.5 py-0.5 bg-zinc-900 text-zinc-500 rounded text-[8px] font-mono">
                              {event}
                            </span>
                          ))}
                          {webhook.events.length > 4 && (
                            <span className="px-1.5 py-0.5 bg-zinc-900 text-zinc-600 rounded text-[8px] font-mono">
                              +{webhook.events.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {webhookDeliveries.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-zinc-800">
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">Recent Deliveries</h4>
                      <div className="space-y-1.5">
                        {webhookDeliveries.map((delivery) => (
                          <div key={delivery.id} className="flex items-center justify-between gap-3 text-[10px] font-mono">
                            <span className="text-zinc-500 truncate">{delivery.event}</span>
                            <span className={`shrink-0 uppercase ${
                              delivery.status === 'delivered'
                                ? 'text-emerald-400'
                                : delivery.status === 'failed'
                                  ? 'text-red-400'
                                  : delivery.status === 'sending'
                                    ? 'text-blue-400'
                                    : 'text-amber-400'
                            }`}>
                              {delivery.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment History */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <BarChart3 size={14} className="text-emerald-500" /> Payment History
                    </h3>
                    <button
                      onClick={loadDashboard}
                      className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Refresh
                    </button>
                  </div>

                  {payments.length === 0 ? (
                    <div className="text-center py-8">
                      <DollarSign className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-600 text-xs font-mono">No payments received yet</p>
                      <p className="text-zinc-700 text-[10px] font-mono mt-1">Completed task payments show here</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((payment, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-black/30 border border-zinc-800/50 rounded hover:border-zinc-700 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-white truncate">{payment.title}</div>
                            <div className="text-[10px] text-zinc-600 font-mono">
                              {payment.completedAt ? new Date(payment.completedAt).toLocaleDateString() : "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-bold font-mono text-emerald-500">
                                +${parseFloat(payment.amount.replace(/[^0-9.]/g, '') || '0').toFixed(2)}
                              </div>
                              <div className="text-[9px] text-zinc-600 font-mono">USDC</div>
                            </div>
                            {payment.solscanUrl ? (
                              <a
                                href={payment.solscanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-500 hover:text-emerald-500 transition-colors"
                                title="View on Solscan"
                              >
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <CheckCircle size={12} className="text-zinc-700" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
