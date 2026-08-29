"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useModalStatus, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain, useWalletClient } from "wagmi";
import type { Hex } from "viem";
import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, ExternalLink, Play, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BnbButtonLoader } from "@/app/bnb/_components/BnbButtonLoader";
import { BnbAgentAvatar } from "@/app/bnb/_components/BnbAgentAvatar";
import { CopyValueButton } from "@/app/bnb/_components/CopyValueButton";
import { BnbDeliveryView } from "@/app/bnb/_components/BnbDeliveryView";
import { useAuth } from "@/hooks/useAuth";
import { useBnbAuthFetch } from "@/hooks/useBnbAuthFetch";
import type { BnbAgentProfile, BnbHireIntentInput, BnbJobCapability, BnbJobPreflightResult, BnbJobSpec, BnbPaymentRequest } from "@/lib/bnb/types";
import {
  BNB_CUSTOM_TOKEN_OPTION,
  BNB_RISK_PREFERENCES,
  BNB_YIELD_SOURCE_CONNECTED_WALLET,
  allowedBnbJobCapabilitiesForAgent,
  applyBnbJobDefinitionFieldDefaults,
  bnbJobFieldValue,
  bnbJobTaskLabel,
  capabilityForBnbAgent,
  defaultBnbIntentTarget,
  defaultBnbYieldSource,
  getBnbAgentJobCapability,
  getBnbJobCapability,
  getBnbJobSpecDefinition,
  isBnbJobFieldRequired,
  summaryBnbJobFields,
  validateBnbJobField,
  validateBnbJobPriceBounds,
  validateBnbYieldFields,
  validateOptionalBnbJobField,
  visibleBnbJobFields,
  type BnbJobFieldDefinition,
  yieldBnbJobUsesConnectedWallet,
} from "@/lib/bnb/jobs";
import {
  getClientBnbChain,
  getClientBnbChainId,
  getClientBnbExplorerAddressUrl,
  getClientBnbExplorerTxUrl,
  getClientBnbNativeSymbol,
} from "@/lib/bnb/client-chain";
import { bnbAgentDisplayName, bnbAgentHasListedPayment, bnbCategoryLabel, bnbStatusLabel } from "@/lib/bnb/display";
import { bnbRefundUnavailableReason } from "@/lib/bnb/settlement-state";
import { BnbSelect } from "@/app/bnb/_components/BnbSelect";
import {
  bnbX402ChainId,
  bnbX402Signer,
  createBnbX402PaymentConfirmation,
  getBnbX402Permit2Approval,
} from "@/lib/bnb/client-x402";
import styles from "./hire.module.css";

type PaymentRequest = BnbPaymentRequest;

type SettlementRequest =
  | {
      status: "ready";
      chainId: number;
      to: string;
      value: string;
      data: string;
      gasLimit?: string;
      label: string;
      action: "release" | "refund";
      jobId: string;
    }
  | {
      status: "setup_required" | "not_ready";
      reason: string;
    };

type ActivationRecordView = {
  status: string;
  limits: {
    task: string;
    budget: string;
    expires: string;
    walletConfirmationRequired: boolean;
  };
  jobSpec?: BnbJobSpec;
  delivery?: {
    status: "pending" | "running" | "delivered" | "failed";
    summary?: string;
    rawOutput?: string;
    error?: string;
    dataSources?: string[];
  };
  work?: {
    status: "not_started" | "running" | "completed" | "failed";
    output?: string;
    error?: string;
    dataSources?: string[];
  };
  payment?: {
    mode?: "none" | "escrow" | "x402";
    chainId?: number;
    contractAddress?: string;
    transactionStatus?: "success" | "reverted" | "pending";
    transactionHash?: string;
    explorerUrl?: string;
    jobId?: string;
    expiresAt?: number;
    x402?: {
      status?: "pending" | "verified" | "settled" | "unconfirmed" | "failed";
      transaction?: string;
      network?: string;
      payer?: string;
    };
  };
  settlement?: {
    action: "release" | "refund";
    transactionHash?: string;
    transactionStatus?: "success" | "reverted" | "pending";
    explorerUrl?: string;
  };
};

type ActivationResponse = {
  status: string;
  message: string;
  receiptId: string;
  recordId: string;
  jobSpec?: BnbJobSpec;
  limits: {
    task: string;
    budget: string;
    expires: string;
    walletConfirmationRequired: boolean;
  };
  paymentRequest: PaymentRequest;
  record?: ActivationRecordView;
  paymentRequired?: boolean;
  paymentMode?: "none" | "escrow" | "x402";
};

type BnbPreflightResponse = BnbJobPreflightResult & {
  message: string;
  agent?: {
    chainId: number;
    tokenId: string;
    executionStatus?: string;
    activationStatus?: string;
  };
};

type Stage = "details" | "preflight" | "payment" | "job";
type JobFormValidation = {
  firstError: string;
  outcome: string;
  target: string;
  budget: string;
  instructions: string;
  fields: Record<string, string>;
};

const paymentStages: Exclude<Stage, "job">[] = ["details", "preflight", "payment"];
const expiryOptions = ["1 hour", "6 hours", "24 hours", "3 days", "7 days"];

export function ActivationForm({ agent }: { agent: BnbAgentProfile }) {
  const nativeSymbol = getClientBnbNativeSymbol();
  const targetChain = getClientBnbChain();
  const targetChainId = getClientBnbChainId();
  const targetChainName = targetChain.name;
  const listedPaymentRequired = bnbAgentHasListedPayment(agent);
  const allowedCapabilities = useMemo(() => allowedBnbJobCapabilitiesForAgent(agent), [agent]);
  const initialCapability = allowedCapabilities[0] || "custom";
  const initialDefinition = useMemo(() => getBnbAgentJobCapability(agent, initialCapability), [agent, initialCapability]);
  const [stage, setStage] = useState<Stage>("details");
  const [capability, setCapability] = useState<BnbJobCapability>(initialCapability);
  const [taskType, setTaskType] = useState(() => initialDefinition.defaultTaskType);
  const definition = useMemo(() => getBnbAgentJobCapability(agent, capability, taskType), [agent, capability, taskType]);
  const [outcome, setOutcome] = useState(() => defaultOutcome(agent));
  const [target, setTarget] = useState("");
  const [riskPreference, setRiskPreference] = useState<(typeof BNB_RISK_PREFERENCES)[number]>("Balanced");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const [spendCap, setSpendCap] = useState(() => nativePriceFromAgent(agent));
  const [expiry, setExpiry] = useState("24 hours");
  const [submitted, setSubmitted] = useState(false);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [running, setRunning] = useState(false);
  const [settling, setSettling] = useState<"release" | "refund" | null>(null);
  const [authAction, setAuthAction] = useState<"login" | "connect" | "">("");
  const [authReadyTimedOut, setAuthReadyTimedOut] = useState(false);
  const [walletAction, setWalletAction] = useState("");
  const [walletError, setWalletError] = useState("");
  const [result, setResult] = useState<ActivationResponse | null>(null);
  const [preflightResult, setPreflightResult] = useState<BnbPreflightResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState("");
  const walletTargetChainId = paymentChainId(result?.paymentRequest, targetChainId);
  const walletTargetChainName = bnbChainName(walletTargetChainId, targetChainName);
  const { authenticated, login, ready, connectWallet } = useAuth();
  const { address, chainId } = useAccount();
  const { isOpen: privyModalOpen } = useModalStatus();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: walletTargetChainId });
  const { wallets, ready: walletsReady } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { authFetch } = useBnbAuthFetch();
  const evmWallets = useMemo(
    () => wallets.filter((wallet): wallet is ConnectedWallet => wallet.type === "ethereum"),
    [wallets],
  );
  const activeWallet = evmWallets.find((wallet) => sameAddress(wallet.address, address));
  const selectedEndpointContract = definition.endpointCapabilities?.[taskType];
  const preliminaryPaymentMode = selectedEndpointContract
    ? selectedEndpointContract.paymentRequired === true
      ? selectedEndpointContract.adapter === "x402" ? "x402" : "escrow"
      : "none"
    : listedPaymentRequired ? "escrow" : "none";
  const effectivePaymentMode = result?.paymentMode || preflightResult?.paymentMode || preliminaryPaymentMode;
  const effectivePaymentRequired = effectivePaymentMode !== "none";
  const escrowBudgetRequired = effectivePaymentMode === "escrow";
  const paymentNotRequired = result?.paymentRequest.status === "not_required" || result?.record?.limits.walletConfirmationRequired === false;
  const funded = paymentNotRequired || result?.record?.payment?.transactionStatus === "success" || result?.status === "funded" || result?.status === "payment_confirmed" || result?.status === "delivered";
  const delivered = result?.record?.delivery?.status === "delivered" || result?.record?.work?.status === "completed" || result?.status === "delivered" || result?.status === "work_completed";
  const closed = result?.status === "paid" || result?.status === "released" || result?.status === "refunded";
  const intent = buildClientHireIntent({ definition, capability, taskType, outcome, target, riskPreference, fields, instructions, walletAddress: address });
  const jobSpec = preflightResult?.jobSpec || buildClientIntentPreview(intent, definition);
  const validation = useMemo(
    () => validateJobForm({ definition, fields, outcome, target, taskType, spendCap, instructions, nativeSymbol, walletAddress: address, paymentRequired: escrowBudgetRequired }),
    [address, definition, escrowBudgetRequired, fields, instructions, nativeSymbol, outcome, spendCap, target, taskType],
  );
  const detailsComplete = !validation.firstError;
  const preflightComplete = Boolean(preflightResult?.canProceed && preflightResult.jobSpec);
  const spendCapLabel = escrowBudgetRequired && spendCap.trim() ? `${spendCap.trim()} ${nativeSymbol}` : "No payment";
  const authInitializing = !ready && !address && !authReadyTimedOut;
  const authBusy = authAction === "login" || privyModalOpen;

  useEffect(() => {
    if (!authenticated || address || evmWallets.length === 0) return;
    setActiveWallet(evmWallets[0]).catch(() => undefined);
  }, [address, authenticated, evmWallets, setActiveWallet]);

  useEffect(() => {
    if (!privyModalOpen) {
      setAuthAction("");
    }
  }, [privyModalOpen]);

  useEffect(() => {
    if (ready || address) {
      setAuthReadyTimedOut(false);
      return;
    }

    const timeout = window.setTimeout(() => setAuthReadyTimedOut(true), 2_500);
    return () => window.clearTimeout(timeout);
  }, [address, ready]);

  useEffect(() => {
    if (allowedCapabilities.includes(capability)) return;
    setCapability(initialCapability);
    setSubmitted(false);
    setError(null);
    setPreflightResult(null);
  }, [allowedCapabilities, capability, initialCapability]);

  useEffect(() => {
    const nextDefinition = getBnbAgentJobCapability(agent, capability);
    setTaskType(nextDefinition.defaultTaskType);
    setFields((current) => {
      return applyBnbJobDefinitionFieldDefaults(nextDefinition, nextDefinition.defaultTaskType, current);
    });
  }, [agent, capability]);

  function openWalletConnector() {
    if (!ready && !address) {
      setError("Wallet sign-in is still initializing. Refresh this page and try again.");
      return;
    }

    setAuthAction("connect");
    setWalletError("");
    connectWallet({
      walletChainType: "ethereum-only",
      description: `Connect the wallet you want to use on ${targetChainName}.`,
    });
  }

  function signInWithBnbWallet() {
    if (!ready && !address) {
      setError("Wallet sign-in is still initializing. Refresh this page and try again.");
      return;
    }

    setAuthAction("login");
    login({
      loginMethods: ["wallet"],
      walletChainType: "ethereum-only",
    });
  }

  async function useWallet(wallet: ConnectedWallet) {
    setWalletAction(`wallet:${wallet.address}`);
    setWalletError("");

    try {
      await setActiveWallet(wallet);
    } catch (walletSetError) {
      setWalletError(walletSetError instanceof Error ? walletSetError.message : "Could not switch wallet.");
    } finally {
      setWalletAction("");
    }
  }

  async function switchToBnb() {
    setWalletAction("switch");
    setWalletError("");

    try {
      await switchChainAsync({ chainId: walletTargetChainId });
    } catch (switchError) {
      setWalletError(switchError instanceof Error ? switchError.message : "Could not switch network.");
    } finally {
      setWalletAction("");
    }
  }

  async function ensureBnbWallet(requiredChainId = targetChainId) {
    if (!authenticated && !address) {
      signInWithBnbWallet();
      return false;
    }

    if (!address) {
      openWalletConnector();
      setError("Connect a wallet to continue.");
      return false;
    }

    if (chainId !== requiredChainId) {
      await switchChainAsync({ chainId: requiredChainId });
    }

    return true;
  }

  async function validateJob() {
    setError(null);
    setResult(null);
    setPreflightResult(null);
    setSubmitted(true);

    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;
    if (!address) {
      openWalletConnector();
      setError("Connect a wallet to continue.");
      return;
    }
    if (validation.firstError) {
      setError(null);
      return;
    }

    setPreflightLoading(true);
    try {
      const response = await authFetch("/api/bnb/activate/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: agent.chainId,
          tokenId: agent.tokenId,
          intent,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(userFacingJobIssue(payload.error || "Could not check this job."));
      setPreflightResult(payload);
      setStage("preflight");
      if (!payload.canProceed) {
        setError(null);
      }
    } catch (preflightError) {
      setError(userFacingJobIssue(preflightError instanceof Error ? preflightError.message : "Could not check this job."));
    } finally {
      setPreflightLoading(false);
    }
  }

  async function preparePayment() {
    setError(null);

    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;
    if (!preflightResult?.canProceed || !preflightResult.jobSpec) {
      setError("Review this job before continuing.");
      setStage("preflight");
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch("/api/bnb/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: agent.chainId,
          tokenId: agent.tokenId,
          intent,
          spendCap: spendCapLabel,
          expiry,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not prepare this job.");
      setResult(payload);
      if (payload.paymentRequest?.status === "not_required") {
        setStage("job");
        await runAgent(payload.recordId, payload);
        return;
      }
      setStage("payment");
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Could not prepare this job.");
    } finally {
      setLoading(false);
    }
  }

  async function fundEscrow() {
    if (!result || result.paymentRequest.status !== "ready") return;
    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;

    setFunding(true);
    setError(null);

    try {
      let paymentConfirmation: { transactionHash?: string; paymentHeader?: string };
      if (result.paymentRequest.mode === "x402") {
        const paymentChainId = bnbX402ChainId(result.paymentRequest);
        const walletReady = await ensureBnbWallet(paymentChainId);
        if (!walletReady) return;
        if (!address || !walletClient || !publicClient) {
          throw new Error("Your wallet is not ready for this payment.");
        }
        const approval = await getBnbX402Permit2Approval({
          request: result.paymentRequest,
          ownerAddress: address,
          readContract: (args) => publicClient.readContract(args),
        });
        if (approval) {
          const approvalHash = await sendTransactionAsync({
            to: approval.to,
            data: approval.data,
            value: 0n,
            chainId: paymentChainId,
          });
          const receipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
          if (receipt.status !== "success") throw new Error("Token approval failed.");
        }
        const signed = await createBnbX402PaymentConfirmation({
          request: result.paymentRequest,
          signer: bnbX402Signer(walletClient, address),
        });
        paymentConfirmation = { paymentHeader: signed.paymentHeader };
      } else {
        const walletReady = await ensureBnbWallet(targetChainId);
        if (!walletReady) return;
        const hash = await sendTransactionAsync({
          to: result.paymentRequest.to as Hex,
          data: result.paymentRequest.data as Hex,
          value: BigInt(result.paymentRequest.value),
          gas: result.paymentRequest.gasLimit ? BigInt(result.paymentRequest.gasLimit) : undefined,
          chainId: targetChainId,
        });
        setPaymentHash(hash);
        paymentConfirmation = { transactionHash: hash };
      }

      const response = await authFetch("/api/bnb/activate/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId, ...paymentConfirmation }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Payment was sent, but the job could not be updated.");
      setResult((current) => current ? { ...current, status: payload.status, message: payload.message, record: payload.record } : current);
      setStage("job");
      if (payload.record?.payment?.transactionStatus === "success" || payload.status === "funded") {
        await runAgent(payload.recordId || result.recordId);
      }
    } catch (fundingError) {
      setError(fundingError instanceof Error ? fundingError.message : "Could not confirm payment.");
    } finally {
      setFunding(false);
    }
  }

  async function runAgent(recordId = result?.recordId, seedResult?: ActivationResponse) {
    if (!recordId) return;
    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;
    setRunning(true);
    setError(null);

    try {
      const response = await authFetch("/api/bnb/activate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.record) {
          setResult((current) => {
            const base = current || seedResult;
            return base ? { ...base, status: payload.status || "failed", message: payload.error || "Agent run failed.", record: payload.record } : current;
          });
          setStage("job");
        }
        throw new Error(payload.error || "Agent run failed.");
      }
      setResult((current) => {
        const base = current || seedResult;
        return base ? { ...base, status: payload.status, message: payload.message, record: payload.record } : current;
      });
      setStage("job");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Agent run failed.");
    } finally {
      setRunning(false);
    }
  }

  async function settleEscrow(action: "release" | "refund") {
    if (!result) return;
    if (!ensureProtectedSession({ authenticated, walletAddress: address, login: signInWithBnbWallet })) return;

    setSettling(action);
    setError(null);

    try {
      const walletReady = await ensureBnbWallet();
      if (!walletReady) return;

      const prepareResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId, action }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare payment transaction.");

      const settlementRequest = prepared.settlementRequest as SettlementRequest;
      if (settlementRequest.status !== "ready") throw new Error(settlementRequest.reason);

      const hash = await sendTransactionAsync({
        to: settlementRequest.to as Hex,
        data: settlementRequest.data as Hex,
        value: BigInt(settlementRequest.value),
        gas: settlementRequest.gasLimit ? BigInt(settlementRequest.gasLimit) : undefined,
        chainId: targetChainId,
      });

      const confirmResponse = await authFetch("/api/bnb/activate/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: result.recordId, action, transactionHash: hash }),
      });
      const payload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(payload.error || "Transaction was sent, but the job could not be updated.");

      setResult((current) => current ? { ...current, status: payload.status, message: payload.message, record: payload.record } : current);
    } catch (settlementError) {
      setError(settlementError instanceof Error ? settlementError.message : "Could not update payment.");
    } finally {
      setSettling(null);
    }
  }

  return (
    <section className={`${styles.hireWorkspace} bnb-hire-wizard`} aria-busy={preflightLoading || loading || funding || running || Boolean(settling)}>
      <aside className={styles.contextRail} aria-label="Job summary">
        <HireContext
          agent={agent}
          task={bnbJobTaskLabel(definition, taskType)}
          payment={spendCapLabel}
          expiry={expiry}
        />
      </aside>

      <details className={styles.mobileContext}>
        <summary>
          <span>Job summary</span>
          <strong>{bnbJobTaskLabel(definition, taskType)}</strong>
        </summary>
        <HireContext
          agent={agent}
          task={bnbJobTaskLabel(definition, taskType)}
          payment={spendCapLabel}
          expiry={expiry}
        />
      </details>

      <div className={styles.flow}>
        {stage !== "job" ? <StepRail active={stage} completed={{ details: detailsComplete, preflight: preflightComplete, payment: funded }} paymentRequired={effectivePaymentRequired} /> : null}

        <div className={stage === "job" ? styles.jobSurface : styles.stageSurface}>
          {stage === "details" ? (
            <DetailsStage
            agent={agent}
            capability={capability}
            allowedCapabilities={allowedCapabilities}
            onCapabilityChange={(value) => {
              const nextCapability = value as BnbJobCapability;
              if (!allowedCapabilities.includes(nextCapability)) return;
              setCapability(nextCapability);
              setSubmitted(false);
              setError(null);
              setPreflightResult(null);
            }}
            definition={definition}
            taskType={taskType}
            outcome={outcome}
            target={target}
            riskPreference={riskPreference}
            fields={fields}
            instructions={instructions}
            spendCap={spendCap}
            paymentRequired={escrowBudgetRequired}
            expiry={expiry}
            nativeSymbol={nativeSymbol}
            onTaskTypeChange={(value) => {
              setTaskType(value);
              setFields((current) => applyBnbJobDefinitionFieldDefaults(getBnbAgentJobCapability(agent, capability, value), value, current));
              setPreflightResult(null);
            }}
            onOutcomeChange={(value) => {
              setOutcome(value);
              setPreflightResult(null);
            }}
            onTargetChange={(value) => {
              setTarget(value);
              setPreflightResult(null);
            }}
            onRiskPreferenceChange={(value) => {
              setRiskPreference(value as (typeof BNB_RISK_PREFERENCES)[number]);
              setPreflightResult(null);
            }}
            onFieldChange={(key, value) => {
              setFields((current) => ({ ...current, [key]: value }));
              setPreflightResult(null);
            }}
            onInstructionsChange={(value) => {
              setInstructions(value);
              setPreflightResult(null);
            }}
            onSpendCapChange={(value) => {
              setSpendCap(value);
              setPreflightResult(null);
            }}
            onExpiryChange={(value) => {
              setExpiry(value);
              setPreflightResult(null);
            }}
            validation={submitted ? validation : undefined}
            error={error}
            loading={preflightLoading}
            authInitializing={authInitializing}
            authBusy={authBusy}
            authenticated={authenticated}
            walletAddress={address}
            onSubmit={validateJob}
            />
          ) : null}

          {stage === "preflight" ? (
            <PreflightStage
            result={preflightResult}
            jobSpec={jobSpec}
            error={error}
            loading={loading}
            onBack={() => {
              setStage("details");
              setError(null);
            }}
            onReviewPayment={preparePayment}
            />
          ) : null}

          {stage === "payment" ? (
            <PaymentStage
            result={result}
            agent={agent}
            jobSpec={jobSpec}
            spendCapLabel={spendCapLabel}
            expiry={expiry}
            paymentHash={paymentHash}
            funding={funding}
            error={error}
            walletPanel={
              <WalletPanel
                authenticated={authenticated}
                ready={ready}
                walletsReady={walletsReady}
                address={address}
                chainId={chainId}
                targetChainId={walletTargetChainId}
                targetChainName={walletTargetChainName}
                nativeSymbol={nativeSymbol}
                activeWallet={activeWallet}
                wallets={evmWallets}
                authAction={authAction}
                action={walletAction}
                error={walletError}
                onLogin={signInWithBnbWallet}
                onConnect={openWalletConnector}
                onUseWallet={useWallet}
                onSwitchChain={switchToBnb}
              />
            }
            onBack={() => {
              setResult(null);
              setPaymentHash("");
              setStage("details");
            }}
            onFund={fundEscrow}
            />
          ) : null}

          {stage === "job" ? (
            <JobStatusPanel
            result={result}
            agent={agent}
            funded={funded}
            delivered={delivered}
            closed={closed}
            running={running}
            settling={settling}
            error={error}
            onRun={() => runAgent()}
            onRelease={() => settleEscrow("release")}
            onRefund={() => settleEscrow("refund")}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HireContext({
  agent,
  task,
  payment,
  expiry,
}: {
  agent: BnbAgentProfile;
  task: string;
  payment: string;
  expiry: string;
}) {
  const agentName = bnbAgentDisplayName(agent);
  return (
    <div className={styles.contextPanel}>
      <div className={styles.contextIdentity}>
        <BnbAgentAvatar agent={agent} />
        <div>
          <small>{bnbCategoryLabel(agent.category)}</small>
          <strong>{agentName}</strong>
        </div>
      </div>
      <dl className={styles.contextFacts}>
        <div><dt>Job</dt><dd>{task}</dd></div>
        <div><dt>Availability</dt><dd>{bnbStatusLabel(agent)}</dd></div>
        <div><dt>Maximum payment</dt><dd>{payment}</dd></div>
        <div><dt>Time limit</dt><dd>{expiry}</dd></div>
      </dl>
    </div>
  );
}

function StepRail({
  active,
  completed,
  paymentRequired,
}: {
  active: Exclude<Stage, "job">;
  completed: Partial<Record<Exclude<Stage, "job">, boolean>>;
  paymentRequired: boolean;
}) {
  const activeIndex = paymentStages.indexOf(active);
  return (
    <ol className="bnb-hire-steps" aria-label="Hire progress">
      {paymentStages.map((stage, index) => (
        <li key={stage} data-active={stage === active ? "true" : undefined} data-complete={completed[stage] || index < activeIndex ? "true" : undefined}>
          <span>{completed[stage] || index < activeIndex ? <CheckCircle2 aria-hidden="true" size={14} /> : index + 1}</span>
          <strong>{stageLabel(stage, paymentRequired)}</strong>
        </li>
      ))}
    </ol>
  );
}

function DetailsStage({
  agent,
  capability,
  allowedCapabilities,
  onCapabilityChange,
  definition,
  taskType,
  outcome,
  target,
  riskPreference,
  fields,
  instructions,
  spendCap,
  paymentRequired,
  expiry,
  nativeSymbol,
  onTaskTypeChange,
  onOutcomeChange,
  onTargetChange,
  onRiskPreferenceChange,
  onFieldChange,
  onInstructionsChange,
  onSpendCapChange,
  onExpiryChange,
  validation,
  error,
  loading,
  authInitializing,
  authBusy,
  authenticated,
  walletAddress,
  onSubmit,
}: {
  agent: BnbAgentProfile;
  capability: BnbJobCapability;
  allowedCapabilities: BnbJobCapability[];
  onCapabilityChange: (value: string) => void;
  definition: ReturnType<typeof getBnbJobCapability>;
  taskType: string;
  outcome: string;
  target: string;
  riskPreference: string;
  fields: Record<string, string>;
  instructions: string;
  spendCap: string;
  paymentRequired: boolean;
  expiry: string;
  nativeSymbol: string;
  onTaskTypeChange: (value: string) => void;
  onOutcomeChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onRiskPreferenceChange: (value: string) => void;
  onFieldChange: (key: string, value: string) => void;
  onInstructionsChange: (value: string) => void;
  onSpendCapChange: (value: string) => void;
  onExpiryChange: (value: string) => void;
  validation?: JobFormValidation;
  error: string | null;
  loading: boolean;
  authInitializing: boolean;
  authBusy: boolean;
  authenticated: boolean;
  walletAddress?: string;
  onSubmit: () => void;
}) {
  const visibleFields = visibleJobFields(definition, { fields, taskType });
  const requiredFields = visibleFields.filter((field) => (
    definition.schemaDerived
      ? field.required
      : field.required || isConditionallyRequiredJobField(definition.capability, taskType, fields, field)
  ));
  const optionalFields = visibleFields.filter((field) => !requiredFields.includes(field));
  const usingConnectedYieldWallet = !definition.schemaDerived && definition.capability === "yield_optimisation" && yieldUsesConnectedWallet(taskType, fields);
  const customJob = definition.capability === "custom";
  const canSubmit = definition.taskTypes.length > 0 && allowedCapabilities.length > 0;
  const capabilityOptions = allowedCapabilities.map((item) => {
    const capabilityDefinition = getBnbJobCapability(item);
    return { value: capabilityDefinition.capability, label: capabilityDefinition.label };
  });

  return (
    <form
      className="bnb-hire-stage"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <StepHead title="Job" />
      <div className="bnb-form-grid">
        <label>
          <span className="bnb-label">Capability</span>
          {capabilityOptions.length > 1 ? (
            <BnbSelect
              value={capability}
              onChange={onCapabilityChange}
              options={capabilityOptions}
              ariaLabel="Capability"
            />
          ) : (
            <span className="bnb-static-field">{definition.label}</span>
          )}
        </label>
        <label>
          <span className="bnb-label">Job</span>
          <BnbSelect
            value={taskType}
            onChange={onTaskTypeChange}
            options={definition.taskTypes.map((task) => ({ value: task, label: bnbJobTaskLabel(definition, task) }))}
            ariaLabel="Job"
          />
        </label>
        <fieldset className={styles.segmentedField}>
          <legend className="bnb-label">Risk</legend>
          <div>
            {BNB_RISK_PREFERENCES.map((risk) => (
              <label key={risk}>
                <input
                  type="radio"
                  name="bnb-risk-preference"
                  value={risk}
                  checked={riskPreference === risk}
                  onChange={(event) => onRiskPreferenceChange(event.target.value)}
                />
                <span>{risk}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {!customJob && !definition.schemaDerived ? (
          <label className="bnb-form-span">
            <span className="bnb-label">Desired outcome *</span>
            <textarea
              value={outcome}
              onChange={(event) => onOutcomeChange(event.target.value)}
              className="bnb-textarea"
              placeholder="Example: Check my Venus borrow position and tell me whether it is near liquidation."
              maxLength={1200}
              aria-invalid={validation?.outcome ? "true" : undefined}
            />
            {validation?.outcome ? <p className="bnb-field-error">{validation.outcome}</p> : null}
          </label>
        ) : null}
        {requiredFields.map((field) => (
          <JobField
            key={field.key}
            field={field}
            value={jobFieldValue({ capability, field, fields, walletAddress })}
            error={validation?.fields[field.key] || ""}
            onChange={(value) => {
              if (field.key === "walletOrPosition") onTargetChange(value);
              onFieldChange(field.key, value);
            }}
          />
        ))}
        {usingConnectedYieldWallet && walletAddress ? (
          <>
            <label>
              <span className="bnb-label">Wallet</span>
              <span className="bnb-static-field">{shortAddress(walletAddress)}</span>
            </label>
            <label>
              <span className="bnb-label">Scope</span>
              <span className="bnb-static-field">All wallet assets</span>
            </label>
          </>
        ) : null}
        {paymentRequired ? (
          <label>
            <span className="bnb-label">Budget *</span>
            <span className="bnb-budget-field">
              <input
                value={spendCap}
                onChange={(event) => onSpendCapChange(event.target.value)}
                className="bnb-input"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                placeholder="0.001"
                aria-invalid={validation?.budget ? "true" : undefined}
              />
              <span>{nativeSymbol}</span>
            </span>
            {validation?.budget ? <p className="bnb-field-error">{validation.budget}</p> : null}
          </label>
        ) : null}
        <label>
          <span className="bnb-label">Time limit</span>
          <BnbSelect
            value={expiry}
            onChange={onExpiryChange}
            options={expiryOptions.map((option) => ({ value: option, label: option }))}
            ariaLabel="Time limit"
          />
        </label>
        <details className="bnb-advanced-details bnb-form-span">
          <summary>Optional details</summary>
          <div className="bnb-form-grid">
            {optionalFields.map((field) => (
              <JobField
                key={field.key}
                field={field}
                value={fields[field.key] || ""}
                error={validation?.fields[field.key] || ""}
                optionalLabel
                onChange={(value) => onFieldChange(field.key, value)}
              />
            ))}
            <label className="bnb-form-span">
              <span className="bnb-label">Notes</span>
              <textarea
                value={instructions}
                onChange={(event) => onInstructionsChange(event.target.value)}
                className="bnb-textarea"
                placeholder="Constraints, preferences, or context."
                maxLength={1200}
              />
              {validation?.instructions ? <p className="bnb-field-error">{validation.instructions}</p> : null}
            </label>
          </div>
        </details>
      </div>
      <StepError error={error} />
      <div className="bnb-step-actions">
        <button type="submit" className="bnb-button bnb-focus" disabled={!canSubmit || loading || authBusy || authInitializing} aria-busy={loading || authBusy || authInitializing}>
          {loading || authBusy || authInitializing ? <BnbButtonLoader /> : <ShieldCheck aria-hidden="true" size={16} />}
          {hireIntentButtonLabel({ loading, authBusy, authInitializing, authenticated, walletAddress })}
        </button>
      </div>
    </form>
  );
}

function JobField({
  field,
  value,
  error,
  optionalLabel = false,
  onChange,
}: {
  field: BnbJobFieldDefinition;
  value: string;
  error: string;
  optionalLabel?: boolean;
  onChange: (value: string) => void;
}) {
  const fieldId = `bnb-job-${field.key}`;
  const describedBy = [
    field.helper ? `${fieldId}-hint` : "",
    error ? `${fieldId}-error` : "",
  ].filter(Boolean).join(" ") || undefined;
  const kind = field.kind || (field.multiline ? "textarea" : "text");

  return (
    <label className={field.multiline || kind === "textarea" ? "bnb-form-span" : undefined} htmlFor={fieldId}>
      <span className="bnb-label">{field.label}{field.required && !optionalLabel ? " *" : optionalLabel ? " (optional)" : ""}</span>
      {kind === "select" && field.options ? (
        <BnbSelect
          value={value}
          onChange={onChange}
          options={field.options.map((option) => ({ value: option, label: option }))}
          ariaLabel={field.label}
          placeholder={field.placeholder}
        />
      ) : kind === "textarea" ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bnb-textarea"
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
        />
      ) : (
        <input
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type="text"
          inputMode={kind === "integer" ? "numeric" : kind === "amount" ? "decimal" : "text"}
          pattern={kind === "integer" ? "[0-9]*" : undefined}
          autoComplete="off"
          spellCheck={false}
          className="bnb-input"
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
        />
      )}
      {field.helper ? <p id={`${fieldId}-hint`} className="bnb-field-hint">{field.helper}</p> : null}
      {error ? <p id={`${fieldId}-error`} className="bnb-field-error">{error}</p> : null}
    </label>
  );
}

function PreflightStage({
  result,
  jobSpec,
  error,
  loading,
  onBack,
  onReviewPayment,
}: {
  result: BnbPreflightResponse | null;
  jobSpec: BnbJobSpec;
  error: string | null;
  loading: boolean;
  onBack: () => void;
  onReviewPayment: () => void;
}) {
  const blocked = Boolean(result && !result.canProceed);
  const adapterChecks = result?.adapterPreflight || [];
  const adapterIssues = Array.from(new Set(adapterChecks.filter((check) => !check.ok && check.reason).map((check) => userFacingJobIssue(check.reason as string))));
  const blockedIssues = blocked
    ? Array.from(new Set([userFacingJobIssue(result?.message || "This agent cannot run this job."), ...adapterIssues].filter(Boolean)))
    : [];

  return (
    <div className="bnb-hire-stage">
      <StepHead title="Review" />

      {result ? (
        <>
          <JobReview jobSpec={jobSpec} rows={[{ label: "Delivery", value: jobSpec.expectedOutput }]} />

          {blockedIssues.length > 0 ? (
            <div className="bnb-preflight-list">
              {blockedIssues.map((issue) => (
                <div key={issue} className="bnb-preflight-warning">
                  <AlertTriangle aria-hidden="true" size={16} />
                  <span>
                    <strong>Needs changes</strong>
                    <small>{issue}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bnb-preflight-list">
              <div className="bnb-preflight-ok">
                <CheckCircle2 aria-hidden="true" size={16} />
                <span>
                  <strong>Ready</strong>
                </span>
              </div>
            </div>
          )}

          {result.missingInputs.length > 0 || result.warnings.length > 0 ? (
            <div className="bnb-validation-notes">
              {[...result.missingInputs, ...result.warnings].map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <StepError error={result ? null : error} />
      <div className="bnb-step-actions">
        <button type="button" className="bnb-button-dark bnb-focus" onClick={onBack}><ArrowLeft aria-hidden="true" size={15} /> Edit details</button>
        {!blocked ? (
          <button type="button" className="bnb-button bnb-focus" onClick={onReviewPayment} disabled={!result?.canProceed || loading} aria-busy={loading}>
            {loading ? <BnbButtonLoader /> : result?.paymentRequired === false ? <Play aria-hidden="true" size={16} /> : <ShieldCheck aria-hidden="true" size={16} />}
            {loading ? result?.paymentRequired === false ? "Starting..." : "Preparing..." : result?.paymentRequired === false ? "Run agent" : "Review payment"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PaymentStage({
  result,
  agent,
  jobSpec,
  spendCapLabel,
  expiry,
  paymentHash,
  funding,
  error,
  walletPanel,
  onBack,
  onFund,
}: {
  result: ActivationResponse | null;
  agent: BnbAgentProfile;
  jobSpec: BnbJobSpec;
  spendCapLabel: string;
  expiry: string;
  paymentHash: string;
  funding: boolean;
  error: string | null;
  walletPanel: ReactNode;
  onBack: () => void;
  onFund: () => void;
}) {
  const payment = result?.paymentRequest;
  const paymentAddress = payment?.status === "ready"
    ? payment.mode === "x402" ? payment.payTo : payment.contractAddress || payment.to
    : "";
  const paymentAsset = payment?.status === "ready" && payment.mode === "x402" ? payment.asset : "";
  const paymentNetworkChainId = paymentChainId(payment, getClientBnbChainId());

  return (
    <div className="bnb-hire-stage">
      <StepHead title="Payment" body="Review the job and amount." />
      <div className={styles.paymentAmount}>
        <span>Amount</span>
        <strong>{payment?.status === "ready" ? payment.amountLabel : spendCapLabel}</strong>
      </div>
      <dl className="bnb-hire-review">
        <DataRow label="Agent" value={agent.name} />
        <DataRow label="Budget" value={payment?.status === "ready" ? payment.amountLabel : spendCapLabel} />
        <DataRow label="Time limit" value={expiry} />
        {paymentAddress ? (
          <DataRow
            label="Payment address"
            value={paymentAddress}
            displayValue={shortHash(paymentAddress)}
            href={getClientBnbExplorerAddressUrl(paymentAddress, paymentNetworkChainId)}
            copyValue={paymentAddress}
          />
        ) : null}
        {paymentAsset ? (
          <DataRow
            label="Token"
            value={paymentAsset}
            displayValue={shortHash(paymentAsset)}
            href={getClientBnbExplorerAddressUrl(paymentAsset, paymentNetworkChainId)}
            copyValue={paymentAsset}
          />
        ) : null}
        {paymentHash ? (
          <DataRow
            label="Transaction"
            value={paymentHash}
            displayValue={shortHash(paymentHash)}
            href={getClientBnbExplorerTxUrl(paymentHash, paymentNetworkChainId)}
            copyValue={paymentHash}
          />
        ) : null}
      </dl>
      <JobReview jobSpec={jobSpec} rows={[{ label: "Delivery", value: jobSpec.expectedOutput }]} />
      {walletPanel}
      {payment && payment.status !== "ready" && payment.reason ? <div className="bnb-warning p-4 text-sm">{payment.reason}</div> : null}
      <StepError error={error} />
      <div className="bnb-step-actions">
        <button type="button" className="bnb-button-dark bnb-focus" onClick={onBack}><ArrowLeft aria-hidden="true" size={15} /> Edit details</button>
        {payment?.status === "ready" ? (
          <button type="button" onClick={onFund} disabled={funding} className="bnb-button bnb-focus" aria-busy={funding}>
            {funding ? <BnbButtonLoader /> : <CreditCard aria-hidden="true" size={16} />}
            {funding ? "Confirming..." : `Pay ${payment.amountLabel}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function JobStatusPanel({
  result,
  agent,
  funded,
  delivered,
  closed,
  running,
  settling,
  error,
  onRun,
  onRelease,
  onRefund,
}: {
  result: ActivationResponse | null;
  agent: BnbAgentProfile;
  funded: boolean;
  delivered: boolean;
  closed: boolean;
  running: boolean;
  settling: "release" | "refund" | null;
  error: string | null;
  onRun: () => void;
  onRelease: () => void;
  onRefund: () => void;
}) {
  const output = result?.record?.delivery?.rawOutput || result?.record?.work?.output;
  const dataSources = result?.record?.delivery?.dataSources || result?.record?.work?.dataSources;
  const refundBlocker = result?.record ? bnbRefundUnavailableReason(result.record) : "";
  const jobHref = result?.recordId ? `/jobs/${encodeURIComponent(result.recordId)}` : `/agents/${agent.chainId}/${agent.tokenId}`;
  const record = result?.record;
  const recordChainId = record?.payment?.chainId || getClientBnbChainId();
  const fundedExplorerUrl = record?.payment?.explorerUrl || (record?.payment?.transactionHash ? getClientBnbExplorerTxUrl(record.payment.transactionHash, recordChainId) : "");
  const settlementExplorerUrl = record?.settlement?.explorerUrl || (record?.settlement?.transactionHash ? getClientBnbExplorerTxUrl(record.settlement.transactionHash, recordChainId) : "");
  const paymentNotRequired = result?.paymentRequest.status === "not_required" || record?.limits.walletConfirmationRequired === false;
  const jobRunning = running || record?.delivery?.status === "running" || record?.work?.status === "running" || record?.status === "running";
  const showSettlementActions = record?.payment?.mode === "escrow" && delivered && !closed;
  const recordFailed = record?.delivery?.status === "failed" || record?.work?.status === "failed" || record?.status === "failed";
  const runBlocked = Boolean(error && funded && !delivered && !closed && !jobRunning);
  const failed = recordFailed || runBlocked;
  const failureMessage = record?.delivery?.error || record?.work?.error || error || "Agent run failed.";
  const cannotRun = /cannot run|does not expose|matching|no supported execution endpoint|endpoint cannot/i.test(failureMessage);
  const title = closed ? "Job closed" : failed ? cannotRun ? "Job cannot run" : "Job failed" : delivered ? "Delivery" : jobRunning ? "Running" : funded ? paymentNotRequired ? "Run" : "Payment sent" : "Payment";
  const taskTitle = record?.jobSpec
    ? bnbJobTaskLabel(getBnbJobSpecDefinition(record.jobSpec), record.jobSpec.taskType)
    : result?.limits.task || "Agent job";
  const lifecycle = jobLifecycle({
    hasRecord: Boolean(record || result?.recordId),
    paymentNotRequired,
    funded,
    jobRunning,
    delivered,
    failed,
    closed,
    refunded: result?.status === "refunded",
    usesEscrow: record?.payment?.mode === "escrow",
  });

  return (
    <div className={styles.jobWorkbench}>
      <header className={styles.jobHeader}>
        <div className={styles.jobStatusLine} data-state={failed ? "failed" : jobRunning ? "running" : delivered || closed ? "complete" : "pending"}>
          {jobRunning ? <BnbButtonLoader /> : <span aria-hidden="true" />}
          <strong>{title}</strong>
        </div>
        <h2>{taskTitle}</h2>
        <p>{bnbAgentDisplayName(agent)}{result?.recordId ? ` · Record ${shortHash(result.recordId)}` : ""}</p>
      </header>

      <div className={styles.jobBody}>
        <section className={styles.lifecycle} aria-labelledby="job-progress-title">
          <h3 id="job-progress-title">Progress</h3>
          <ol>
            {lifecycle.map((step) => (
              <li key={step.label} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
                <span aria-hidden="true">{step.state === "complete" ? <CheckCircle2 size={14} /> : step.state === "current" ? <BnbButtonLoader /> : null}</span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.resultArea} aria-labelledby="job-result-title">
          <div className={styles.sectionHeading}>
            <span>Result</span>
            <h3 id="job-result-title">{output ? "Delivered work" : failed ? "Work stopped" : jobRunning ? "Agent is working" : "Ready to start"}</h3>
          </div>
          {output ? (
            <BnbDeliveryView output={output} jobSpec={result?.record?.jobSpec || result?.jobSpec} dataSources={dataSources} />
          ) : failed ? (
            <div className={styles.failureState} role="alert">
              <strong>{userFacingJobIssue(failureMessage)}</strong>
              <p>{funded ? "The job record is saved and no payment was released." : "No payment was taken for this run."}</p>
            </div>
          ) : jobRunning ? (
            <div className={styles.runningState} role="status" aria-live="polite">
              <span aria-hidden="true"><BnbButtonLoader /></span>
              <div>
                <strong>Waiting for the agent result</strong>
                <p>This job remains available in My hires while it runs.</p>
              </div>
            </div>
          ) : (
            <div className={styles.readyState}>
              <Play aria-hidden="true" size={18} />
              <div>
                <strong>{funded ? "The job is ready" : "Payment is pending"}</strong>
                <p>{funded ? "Start the agent when you are ready." : "Confirm payment before the work begins."}</p>
              </div>
            </div>
          )}
          <StepError error={failed ? null : error} />
        </section>
      </div>

      {record?.payment ? (
        <details className={styles.transactionDetails}>
          <summary>Payment and record details</summary>
          <dl>
            {record.payment.contractAddress ? (
              <DataRow
                label="Payment contract"
                value={record.payment.contractAddress}
                displayValue={shortHash(record.payment.contractAddress)}
                href={getClientBnbExplorerAddressUrl(record.payment.contractAddress, recordChainId)}
                copyValue={record.payment.contractAddress}
              />
            ) : null}
            {record.payment.jobId ? <DataRow label="Job ID" value={record.payment.jobId} displayValue={shortHash(record.payment.jobId)} copyValue={record.payment.jobId} /> : null}
            {record.payment.transactionHash ? (
              <DataRow
                label="Payment"
                value={record.payment.transactionHash}
                displayValue={shortHash(record.payment.transactionHash)}
                href={fundedExplorerUrl}
                copyValue={record.payment.transactionHash}
              />
            ) : null}
            {record.settlement?.transactionHash ? (
              <DataRow
                label="Final transaction"
                value={record.settlement.transactionHash}
                displayValue={shortHash(record.settlement.transactionHash)}
                href={settlementExplorerUrl}
                copyValue={record.settlement.transactionHash}
              />
            ) : null}
          </dl>
        </details>
      ) : null}

      <footer className={styles.jobActions}>
        {funded && !delivered && !closed && !jobRunning && !failed ? (
          <button type="button" onClick={onRun} className="bnb-button bnb-focus">
            Run agent
          </button>
        ) : null}
        {showSettlementActions ? (
          <>
            <button type="button" onClick={onRelease} disabled={Boolean(settling)} className="bnb-button bnb-focus" aria-busy={settling === "release"}>
              {settling === "release" ? <BnbButtonLoader /> : null}
              {settling === "release" ? "Confirming..." : "Release payment"}
            </button>
            {!refundBlocker ? (
              <button type="button" onClick={onRefund} disabled={Boolean(settling)} className="bnb-button-dark bnb-focus" aria-busy={settling === "refund"}>
                {settling === "refund" ? <BnbButtonLoader /> : null}
                {settling === "refund" ? "Confirming..." : "Refund after expiry"}
              </button>
            ) : (
              <p className="bnb-field-hint bnb-action-hint">{refundBlocker}</p>
            )}
          </>
        ) : null}
        {closed ? <span className="bnb-chip bnb-chip-active">{result?.status === "refunded" ? "Refunded" : "Paid"}</span> : null}
        <Link href={jobHref} className="bnb-button-dark bnb-focus">
          <ExternalLink aria-hidden="true" size={15} />
          View job
        </Link>
      </footer>
    </div>
  );
}

type LifecycleState = "complete" | "current" | "pending" | "failed";

function jobLifecycle({
  hasRecord,
  paymentNotRequired,
  funded,
  jobRunning,
  delivered,
  failed,
  closed,
  refunded,
  usesEscrow,
}: {
  hasRecord: boolean;
  paymentNotRequired: boolean;
  funded: boolean;
  jobRunning: boolean;
  delivered: boolean;
  failed: boolean;
  closed: boolean;
  refunded: boolean;
  usesEscrow: boolean;
}): Array<{ label: string; detail: string; state: LifecycleState }> {
  const workState: LifecycleState = failed ? "failed" : delivered ? "complete" : jobRunning ? "current" : funded ? "current" : "pending";
  const resultState: LifecycleState = failed ? "failed" : delivered ? "complete" : "pending";
  const steps: Array<{ label: string; detail: string; state: LifecycleState }> = [
    { label: "Job created", detail: "The work request is recorded.", state: hasRecord ? "complete" : "current" },
    {
      label: paymentNotRequired ? "No payment required" : "Payment",
      detail: paymentNotRequired ? "This agent can run without payment." : funded ? "Payment is confirmed." : "Waiting for payment confirmation.",
      state: paymentNotRequired || funded ? "complete" : "current",
    },
    { label: "Work", detail: failed ? "The run stopped before delivery." : delivered ? "The agent finished the work." : jobRunning ? "In progress." : "Ready to start.", state: workState },
    { label: "Result", detail: delivered ? "The result is available." : failed ? "No usable result was delivered." : "Waiting for delivery.", state: resultState },
  ];
  if (usesEscrow) {
    steps.push({
      label: refunded ? "Refunded" : "Payment release",
      detail: refunded ? "Payment was refunded." : closed ? "Payment was released." : "Available after delivery.",
      state: closed || refunded ? "complete" : delivered ? "current" : "pending",
    });
  }
  return steps;
}

function StepHead({ title, body }: { title: string; body?: string }) {
  return (
    <div className="bnb-hire-step-head">
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

function StepError({ error }: { error: string | null }) {
  return error ? <div className="bnb-error p-3 text-sm">{userFacingJobIssue(error)}</div> : null;
}

function userFacingJobIssue(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/requires external sign-in/i.test(text)) return "This agent needs a separate sign-in.";
  if (/cannot be run from hive|not available for jobs|no callable|does not expose a callable|no supported execution/i.test(text)) {
    return "This agent is not available for jobs.";
  }
  if (/endpoint|adapter|callable|matching/i.test(text) && /cannot run|does not expose|failed|rejected|not available/i.test(text)) {
    return "This agent cannot run this job.";
  }
  return text
    .replace(/\bMCP\b|\bA2A\b|\bx402\b/g, "agent")
    .replace(/\bendpoint\b/gi, "agent")
    .replace(/\badapter\b/gi, "agent")
    .replace(/\bcallable\b/gi, "available")
    .replace(/\s+/g, " ")
    .trim();
}

function DataRow({
  label,
  value,
  displayValue,
  href,
  copyValue,
}: {
  label: string;
  value: string;
  displayValue?: string;
  href?: string;
  copyValue?: string;
}) {
  const visibleValue = displayValue || value;

  return (
    <div className="bnb-data-row">
      <dt>{label}</dt>
      <dd className="bnb-data-value">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" title={value}>
            {visibleValue}
          </a>
        ) : (
          <span title={value}>{visibleValue}</span>
        )}
        {copyValue ? <CopyValueButton value={copyValue} label={label.toLowerCase()} /> : null}
      </dd>
    </div>
  );
}

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

function paymentChainId(request: PaymentRequest | undefined, fallback: 56 | 97): 56 | 97 {
  if (request?.status !== "ready") return fallback;
  if (request.mode === "escrow") return request.chainId === 97 ? 97 : 56;
  try {
    return bnbX402ChainId(request);
  } catch {
    return fallback;
  }
}

function bnbChainName(chainId: number, fallback: string) {
  if (chainId === 56) return "BNB Smart Chain";
  if (chainId === 97) return "BNB Smart Chain Testnet";
  return fallback;
}

function WalletPanel({
  authenticated,
  ready,
  walletsReady,
  address,
  chainId,
  targetChainId,
  targetChainName,
  nativeSymbol,
  activeWallet,
  wallets,
  authAction,
  action,
  error,
  onLogin,
  onConnect,
  onUseWallet,
  onSwitchChain,
}: {
  authenticated: boolean;
  ready: boolean;
  walletsReady: boolean;
  address?: string;
  chainId?: number;
  targetChainId: number;
  targetChainName: string;
  nativeSymbol: string;
  activeWallet?: ConnectedWallet;
  wallets: ConnectedWallet[];
  authAction: "login" | "connect" | "";
  action: string;
  error: string;
  onLogin: () => void;
  onConnect: () => void;
  onUseWallet: (wallet: ConnectedWallet) => void;
  onSwitchChain: () => void;
}) {
  return (
    <div className="bnb-wallet-panel">
      <div className="bnb-wallet-head">
        <div>
          <h2>Wallet</h2>
          <p>{walletSummary({ authenticated, walletsReady, address, chainId, targetChainId, targetChainName, nativeSymbol })}</p>
        </div>
      </div>

      {!authenticated && !address ? (
        <button type="button" className="bnb-button-dark bnb-focus" onClick={onLogin} disabled={!ready || authAction === "login"} aria-busy={authAction === "login"}>
          {authAction === "login" ? <BnbButtonLoader /> : null}
          {authAction === "login" ? "Opening wallet..." : "Sign in"}
        </button>
      ) : null}

      {authenticated && walletsReady && wallets.length === 0 ? (
        <button type="button" className="bnb-button-dark bnb-focus" onClick={onConnect} disabled={authAction === "connect"} aria-busy={authAction === "connect"}>
          {authAction === "connect" ? <BnbButtonLoader /> : null}
          {authAction === "connect" ? "Opening wallet..." : "Connect wallet"}
        </button>
      ) : null}

      {authenticated && wallets.length > 0 ? (
        <div className="bnb-wallet-list">
          {wallets.map((wallet) => {
            const active = sameAddress(wallet.address, address);
            return (
              <button
                key={`${wallet.walletClientType}:${wallet.address}`}
                type="button"
                className="bnb-wallet-row bnb-focus"
                data-active={active ? "true" : undefined}
                onClick={() => onUseWallet(wallet)}
                disabled={action === `wallet:${wallet.address}`}
                aria-busy={action === `wallet:${wallet.address}`}
              >
                <span>
                  <strong>{wallet.meta?.name || wallet.walletClientType || "Wallet"}</strong>
                  <small>{shortAddress(wallet.address)}</small>
                </span>
                <span>{active ? "Active" : action === `wallet:${wallet.address}` ? <><BnbButtonLoader /> Switching...</> : "Use"}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {(authenticated || address) && address ? (
        <div className="bnb-wallet-actions">
          {chainId !== targetChainId ? (
            <button type="button" className="bnb-button bnb-focus" onClick={onSwitchChain} disabled={action === "switch"} aria-busy={action === "switch"}>
              {action === "switch" ? <BnbButtonLoader /> : null}
              {action === "switch" ? "Switching..." : `Switch to ${targetChainName}`}
            </button>
          ) : null}
          <button type="button" className="bnb-button-dark bnb-focus" onClick={onConnect} disabled={authAction === "connect"} aria-busy={authAction === "connect"}>
            {authAction === "connect" ? <BnbButtonLoader /> : null}
            {authAction === "connect" ? "Opening wallet..." : activeWallet ? "Change wallet" : "Connect wallet"}
          </button>
        </div>
      ) : null}

      {error ? <p className="bnb-form-error">{error}</p> : null}
    </div>
  );
}

function buildClientHireIntent({
  definition,
  capability,
  taskType,
  outcome,
  target,
  riskPreference,
  fields,
  instructions,
  walletAddress,
}: {
  definition: ReturnType<typeof getBnbJobCapability>;
  capability: BnbJobCapability;
  taskType: string;
  outcome: string;
  target: string;
  riskPreference: (typeof BNB_RISK_PREFERENCES)[number];
  fields: Record<string, string>;
  instructions: string;
  walletAddress?: string;
}): BnbHireIntentInput {
  const advancedFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value.trim()]).filter(([, value]) => Boolean(value)),
  );
  const endpointCapability = definition.endpointCapabilities?.[taskType];
  const normalizedOutcome = definition.schemaDerived && !outcome.trim()
    ? `Run ${bnbJobTaskLabel(definition, taskType)} and return the result.`
    : capability === "custom" && advancedFields.request
      ? advancedFields.request
      : outcome.trim();
  if (walletAddress) {
    advancedFields.walletAddress = walletAddress;
  }
  if (capability === "health_factor" && walletAddress && !advancedFields.walletOrPosition) {
    advancedFields.walletOrPosition = walletAddress;
  }
  if (capability === "yield_optimisation") {
    if (yieldUsesConnectedWallet(taskType, advancedFields) && walletAddress) {
      advancedFields.walletAddress = walletAddress;
    } else if (advancedFields.asset === BNB_CUSTOM_TOKEN_OPTION && advancedFields.customAsset) {
      advancedFields.intentTarget = advancedFields.customAsset;
    }
  }
  const normalizedTarget = target.trim() || defaultIntentTarget(capability, advancedFields, walletAddress);

  return {
    capability,
    ...(endpointCapability ? { endpointCapability: endpointCapability.name } : {}),
    taskType,
    outcome: normalizedOutcome,
    target: normalizedTarget,
    riskPreference,
    advancedFields,
    instructions: instructions.trim(),
  };
}

function buildClientIntentPreview(intent: BnbHireIntentInput, definition: ReturnType<typeof getBnbJobCapability>): BnbJobSpec {
  const previewWallet = intent.advancedFields?.walletAddress || intent.target || "";
  const selectedTaskType = intent.taskType || definition.defaultTaskType;
  const endpointCapability = definition.endpointCapabilities?.[selectedTaskType];
  const summary = [
    bnbJobTaskLabel(definition, selectedTaskType),
    definition.capability === "custom" || definition.schemaDerived ? "" : intent.outcome ? `Outcome: ${intent.outcome}` : "",
    intent.target && !(definition.capability === "yield_optimisation" && yieldUsesConnectedWallet(selectedTaskType, intent.advancedFields || {})) ? `Target: ${intent.target}` : "",
    `Risk: ${intent.riskPreference || "Balanced"}`,
    ...summaryJobFields(definition, selectedTaskType, intent.advancedFields || {}, previewWallet).map((field) => {
      const value = intent.advancedFields?.[field.key]?.trim();
      return value ? `${field.label}: ${value}` : "";
    }).filter(Boolean),
    ...(definition.capability === "yield_optimisation" && !definition.schemaDerived && yieldUsesConnectedWallet(selectedTaskType, intent.advancedFields || {}) && previewWallet ? [`Wallet: ${previewWallet}`, "Scope: All wallet assets"] : []),
    intent.instructions ? `Notes: ${intent.instructions}` : "",
  ].filter(Boolean).join("\n");

  return {
    capability: intent.capability || definition.capability,
    taskType: selectedTaskType,
    ...(endpointCapability ? { endpointCapability } : {}),
    summary,
    expectedOutput: definition.expectedOutput,
    fields: {
      ...(definition.capability !== "custom" && intent.outcome ? { outcome: intent.outcome } : {}),
      ...(intent.target ? { intentTarget: intent.target } : {}),
      riskPreference: intent.riskPreference || "Balanced",
      ...(intent.advancedFields || {}),
    },
    ...(intent.instructions ? { instructions: intent.instructions } : {}),
  };
}

function validateJobForm({
  definition,
  fields,
  outcome,
  target,
  taskType,
  spendCap,
  instructions,
  nativeSymbol,
  walletAddress,
  paymentRequired,
}: {
  definition: ReturnType<typeof getBnbJobCapability>;
  fields: Record<string, string>;
  outcome: string;
  target: string;
  taskType: string;
  spendCap: string;
  instructions: string;
  nativeSymbol: string;
  walletAddress?: string;
  paymentRequired: boolean;
}): JobFormValidation {
  const fieldErrors: Record<string, string> = {};
  let firstError = "";
  const outcomeError = definition.schemaDerived || definition.capability === "custom" || outcome.trim().length >= 12 ? "" : "Describe the result you want from this agent.";
  if (outcomeError) firstError = outcomeError;
  const targetError = target.trim() && target.trim().length < 3 ? "Target is too short." : "";
  if (targetError && !firstError) firstError = targetError;

  for (const field of visibleJobFields(definition, { fields, taskType })) {
    if (field.key === "riskPreference") continue;
    const value = jobFieldValue({ capability: definition.capability, field, fields, walletAddress });
    const required = definition.schemaDerived
      ? field.required
      : field.required || isConditionallyRequiredJobField(definition.capability, taskType, fields, field);
    const error = required ? validateBnbJobField({ ...field, required: true }, value) : validateOptionalBnbJobField(field, value);
    if (error) {
      fieldErrors[field.key] = error;
      if (!firstError) firstError = error;
    }
  }

  const yieldError = definition.schemaDerived
    ? { field: "", error: "" }
    : validateYieldClientFields(definition.capability, taskType, fields, walletAddress);
  if (yieldError.error) {
    fieldErrors[yieldError.field] = yieldError.error;
    if (!firstError) firstError = yieldError.error;
  }

  const boundsError = validateBnbJobPriceBounds(definition.capability, fields);
  if (boundsError) {
    const key = definition.capability === "concentrated_liquidity" ? "upperPrice" : "upperBound";
    fieldErrors[key] = boundsError;
    if (!firstError) firstError = boundsError;
  }

  let budgetError = "";
  if (paymentRequired) {
    const budget = spendCap.trim();
    if (!budget) {
      budgetError = `Enter a ${nativeSymbol} budget.`;
    } else if (!/^\d+(?:\.\d{1,12})?$/.test(budget) || Number.parseFloat(budget) <= 0) {
      budgetError = `Enter a positive ${nativeSymbol} amount.`;
    }
  }
  if (budgetError && !firstError) firstError = budgetError;

  const instructionsError = instructions.length > 1200 ? "Notes are too long." : "";
  if (instructionsError && !firstError) firstError = instructionsError;

  return {
    firstError,
    outcome: outcomeError,
    target: targetError,
    budget: budgetError,
    instructions: instructionsError,
    fields: fieldErrors,
  };
}

function JobReview({ jobSpec, rows = [] }: { jobSpec: BnbJobSpec; rows?: Array<{ label: string; value: string }> }) {
  return (
    <dl className="bnb-hire-review">
      {jobReviewRows(jobSpec, rows).map((row) => (
        <DataRow key={`${row.label}:${row.value}`} label={row.label} value={row.value} />
      ))}
    </dl>
  );
}

function jobReviewRows(jobSpec: BnbJobSpec, extraRows: Array<{ label: string; value: string }>) {
  const definition = getBnbJobSpecDefinition(jobSpec);
  const fields = jobSpec.fields;
  const yieldRows = jobSpec.capability === "yield_optimisation" && fields.yieldSource === BNB_YIELD_SOURCE_CONNECTED_WALLET && fields.walletAddress
    ? [
      { label: "Wallet", value: fields.walletAddress },
      { label: "Scope", value: "All wallet assets" },
    ]
    : [];
  return [
    { label: "Capability", value: definition.label },
    { label: "Job", value: bnbJobTaskLabel(definition, jobSpec.taskType) },
    ...visibleJobFields(definition, { fields, taskType: jobSpec.taskType }).map((field) => ({ label: field.label, value: fields[field.key] || "" })),
    ...yieldRows,
    { label: "Risk", value: jobSpec.fields.riskPreference || "" },
    ...extraRows,
  ].filter((row) => row.value);
}

function visibleJobFields(
  definition: ReturnType<typeof getBnbJobCapability>,
  options: { fields?: Record<string, string>; taskType?: string } = {},
) {
  return visibleBnbJobFields(definition, options);
}

function summaryJobFields(
  definition: ReturnType<typeof getBnbJobCapability>,
  taskType: string,
  fields: Record<string, string>,
  walletAddress?: string,
) {
  return summaryBnbJobFields(definition, fields, taskType, walletAddress);
}

function isConditionallyRequiredJobField(
  capability: BnbJobCapability,
  taskType: string,
  fields: Record<string, string>,
  field: BnbJobFieldDefinition,
) {
  return isBnbJobFieldRequired(capability, taskType, fields, field);
}

function jobFieldValue({
  capability,
  field,
  fields,
  walletAddress,
}: {
  capability: BnbJobCapability;
  field: BnbJobFieldDefinition;
  fields: Record<string, string>;
  walletAddress?: string;
}) {
  return bnbJobFieldValue({ capability, field, fields, walletAddress });
}

function defaultIntentTarget(capability: BnbJobCapability, fields: Record<string, string>, walletAddress?: string) {
  return defaultBnbIntentTarget(capability, fields, walletAddress);
}

function yieldUsesConnectedWallet(taskType: string, fields: Record<string, string>) {
  return yieldBnbJobUsesConnectedWallet(taskType, fields);
}

function defaultYieldSource(taskType: string) {
  return defaultBnbYieldSource(taskType);
}

function validateYieldClientFields(
  capability: BnbJobCapability,
  taskType: string,
  fields: Record<string, string>,
  walletAddress?: string,
) {
  return validateBnbYieldFields(capability, taskType, fields, walletAddress);
}

function defaultOutcome(agent: BnbAgentProfile) {
  const capability = capabilityForBnbAgent(agent);
  if (capability === "custom") return "";
  if (capability === "concentrated_liquidity") {
    return "Check BSC V3 DEX and fee support.";
  }
  if (agent.category === "Health Factor Monitoring") {
    return "Check my BSC lending position and tell me whether it is near liquidation.";
  }
  if (agent.category === "Yield Optimisation") {
    return "Compare BSC yield routes and recommend a safer option with clear risk notes.";
  }
  if (agent.category === "Grid Trading") {
    return "Review a BSC trading pair and propose grid settings with risk limits.";
  }
  return "";
}

function hireIntentButtonLabel({
  loading,
  authBusy,
  authInitializing,
  authenticated,
  walletAddress,
}: {
  loading: boolean;
  authBusy: boolean;
  authInitializing: boolean;
  authenticated: boolean;
  walletAddress?: string;
}) {
  if (loading) return "Checking...";
  if (authBusy) return "Opening wallet...";
  if (authInitializing) return "Loading...";
  if (!authenticated && !walletAddress) return "Sign in";
  if (!walletAddress) return "Connect wallet";
  return "Review job";
}

function nativePriceFromAgent(agent: BnbAgentProfile) {
  const price = agent.services.find((service) => service.price && /\b(?:t?bnb)\b/i.test(service.price))?.price;
  if (!price) return "";
  const match = price.match(/(\d+(?:\.\d{1,18})?)\s*(t?bnb)/i);
  return match ? match[1] : "";
}

function stageLabel(stage: Exclude<Stage, "job">, paymentRequired: boolean) {
  if (stage === "details") return "Job";
  if (stage === "preflight") return "Review";
  return paymentRequired ? "Payment" : "Run";
}

function ensureProtectedSession({
  authenticated,
  walletAddress,
  login,
}: {
  authenticated: boolean;
  walletAddress?: string;
  login: () => void;
}) {
  if (!authenticated && !walletAddress) {
    login();
    return false;
  }

  return true;
}

function walletSummary({
  authenticated,
  walletsReady,
  address,
  chainId,
  targetChainId,
  targetChainName,
  nativeSymbol,
}: {
  authenticated: boolean;
  walletsReady: boolean;
  address?: string;
  chainId?: number;
  targetChainId: number;
  targetChainName: string;
  nativeSymbol: string;
}) {
  if (!authenticated && !address) return "Sign in before funding a job.";
  if (!walletsReady) return "Loading wallets.";
  if (!address) return `Connect a wallet when you are ready to fund with ${nativeSymbol}.`;
  if (chainId !== targetChainId) return `${shortAddress(address)} is not on ${targetChainName}.`;
  return `${shortAddress(address)} is ready on ${targetChainName}.`;
}

function sameAddress(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}
