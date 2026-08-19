import type { BnbAgentCategory, BnbAgentProfile, BnbHireIntentInput, BnbJobCapability, BnbJobSpec } from "@/lib/bnb/types";

export type BnbJobFieldKind = "text" | "textarea" | "select" | "amount" | "integer" | "address_or_text";

export type BnbJobFieldDefinition = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  kind?: BnbJobFieldKind;
  multiline?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  helper?: string;
};

export type BnbJobCapabilityDefinition = {
  capability: BnbJobCapability;
  label: string;
  defaultTaskType: string;
  taskTypes: readonly string[];
  expectedOutput: string;
  fields: BnbJobFieldDefinition[];
};

export const BNB_YIELD_SOURCE_CONNECTED_WALLET = "Connected wallet";
export const BNB_YIELD_SOURCE_SELECTED_ASSET = "Selected asset";
export const BNB_YIELD_SOURCE_OPTIONS = [BNB_YIELD_SOURCE_CONNECTED_WALLET, BNB_YIELD_SOURCE_SELECTED_ASSET] as const;
export const BNB_CUSTOM_TOKEN_OPTION = "Custom token address";
export const BNB_YIELD_ASSETS = ["BNB", "WBNB", "USDT", "USDC", "BTCB", "ETH", "CAKE", BNB_CUSTOM_TOKEN_OPTION] as const;

export const BNB_JOB_CAPABILITIES: Record<BnbJobCapability, BnbJobCapabilityDefinition> = {
  rebalancing: {
    capability: "rebalancing",
    label: "Rebalancing",
    defaultTaskType: "Review LP position",
    taskTypes: ["Review LP position", "Recommend range update", "Prepare rebalance plan"],
    expectedOutput: "LP range recommendation with risk notes",
    fields: [
      { key: "poolOrPair", label: "Pool or pair", placeholder: "CAKE/BNB or pool address", required: true, kind: "address_or_text", minLength: 3, maxLength: 120 },
      { key: "position", label: "Position", placeholder: "Position address, wallet, or current range", required: true, kind: "address_or_text", minLength: 3, maxLength: 240 },
      {
        key: "target",
        label: "Goal",
        placeholder: "Select goal",
        required: true,
        kind: "select",
        options: ["Recenter position", "Tighten range", "Widen range", "Reduce impermanent loss", "Lower liquidation risk"],
      },
      { key: "constraints", label: "Constraints", placeholder: "Max slippage, protocols to avoid, assets to keep", required: false, kind: "textarea", multiline: true, maxLength: 700 },
    ],
  },
  concentrated_liquidity: {
    capability: "concentrated_liquidity",
    label: "Concentrated Liquidity",
    defaultTaskType: "Prepare V3 liquidity position",
    taskTypes: ["Prepare V3 liquidity position", "Validate V3 range", "Create V3 pool or position", "Increase V3 liquidity"],
    expectedOutput: "Validated V3 liquidity parameters, approval checks, and execution notes",
    fields: [
      { key: "token0", label: "Token 0", placeholder: "0x... or token symbol", required: true, kind: "address_or_text", minLength: 2, maxLength: 120 },
      { key: "token1", label: "Token 1", placeholder: "0x... or token symbol", required: true, kind: "address_or_text", minLength: 2, maxLength: 120 },
      { key: "amount0", label: "Token 0 amount", placeholder: "1.5", required: true, kind: "amount", min: 0, maxLength: 32 },
      { key: "amount1", label: "Token 1 amount", placeholder: "250", required: true, kind: "amount", min: 0, maxLength: 32 },
      { key: "fee", label: "Fee tier", placeholder: "Select fee tier", required: true, kind: "select", options: ["100", "500", "2500", "3000", "10000"], helper: "Uniswap/Pancake V3 fee tier in hundredths of a bip." },
      { key: "lowerPrice", label: "Lower price", placeholder: "580", required: true, kind: "amount", min: 0, maxLength: 32 },
      { key: "upperPrice", label: "Upper price", placeholder: "720", required: true, kind: "amount", min: 0, maxLength: 32 },
      { key: "dex", label: "DEX", placeholder: "Select DEX", required: false, kind: "select", options: ["Auto", "PancakeSwap", "Uniswap", "WAGMI", "OkuTrade"] },
      { key: "recipient", label: "Recipient", placeholder: "Wallet receiving the position", required: false, kind: "address_or_text", minLength: 3, maxLength: 120 },
    ],
  },
  grid_trading: {
    capability: "grid_trading",
    label: "Grid Trading",
    defaultTaskType: "Create grid strategy",
    taskTypes: ["Create grid strategy", "Review grid settings", "Update grid bounds"],
    expectedOutput: "Grid bounds, levels, risk limits, and execution notes",
    fields: [
      { key: "pair", label: "Trading pair", placeholder: "Select pair", required: true, kind: "select", options: ["BNB/USDT", "CAKE/BNB", "ETH/BNB", "BTCB/BNB", "USDC/USDT"] },
      { key: "lowerBound", label: "Lower bound", placeholder: "520", required: true, kind: "amount", min: 0, maxLength: 32, helper: "Quote-asset price." },
      { key: "upperBound", label: "Upper bound", placeholder: "720", required: true, kind: "amount", min: 0, maxLength: 32, helper: "Must be higher than the lower bound." },
      { key: "gridCount", label: "Grid count", placeholder: "Select grid count", required: true, kind: "select", options: ["6", "8", "10", "12", "16", "20", "24"] },
      { key: "riskNotes", label: "Risk notes", placeholder: "Budget, stop conditions, assets to avoid", required: false, kind: "textarea", multiline: true, maxLength: 700 },
    ],
  },
  yield_optimisation: {
    capability: "yield_optimisation",
    label: "Yield Optimisation",
    defaultTaskType: "Compare yield routes",
    taskTypes: ["Compare yield routes", "Find stablecoin yield", "Review current yield position"],
    expectedOutput: "Ranked yield routes with assumptions and risks",
    fields: [
      { key: "yieldSource", label: "Source", placeholder: "Select source", required: true, kind: "select", options: BNB_YIELD_SOURCE_OPTIONS },
      { key: "asset", label: "Asset", placeholder: "Select asset", required: false, kind: "select", options: BNB_YIELD_ASSETS },
      { key: "customAsset", label: "Token address", placeholder: "0x...", required: false, kind: "address_or_text", minLength: 42, maxLength: 42 },
      { key: "amount", label: "Amount", placeholder: "250", required: false, kind: "amount", min: 0, maxLength: 32 },
      { key: "protocols", label: "Protocols", placeholder: "Select protocol scope", required: true, kind: "select", options: ["All supported", "PancakeSwap", "Venus", "Lista", "PancakeSwap and Venus"] },
      { key: "riskPreference", label: "Risk", placeholder: "Select risk level", required: true, kind: "select", options: ["Low", "Balanced", "Aggressive"] },
      { key: "lockup", label: "Lockup", placeholder: "Select lockup", required: false, kind: "select", options: ["No preference", "Liquid only", "Up to 7 days", "Up to 30 days"] },
    ],
  },
  health_factor: {
    capability: "health_factor",
    label: "Health Factor",
    defaultTaskType: "Check liquidation risk",
    taskTypes: ["Check liquidation risk", "Monitor health factor", "Review borrow position"],
    expectedOutput: "Health-factor status, risk threshold, and next actions",
    fields: [
      { key: "walletOrPosition", label: "Wallet or position", placeholder: "Wallet, lending account, or position address", required: true, kind: "address_or_text", minLength: 3, maxLength: 120 },
      { key: "protocol", label: "Protocol", placeholder: "Select protocol", required: true, kind: "select", options: ["Venus", "Lista", "All supported"] },
      { key: "threshold", label: "Alert threshold", placeholder: "Select threshold", required: true, kind: "select", options: ["1.2", "1.4", "1.6", "1.8", "2.0"] },
      { key: "requestedAction", label: "Action", placeholder: "Select action", required: false, kind: "select", options: ["Report only", "Monitor and alert", "Recommend adjustment"] },
    ],
  },
  custom: {
    capability: "custom",
    label: "Custom",
    defaultTaskType: "Custom task",
    taskTypes: ["Custom task"],
    expectedOutput: "Agent result and work record",
    fields: [
      { key: "request", label: "Request", placeholder: "Describe the exact work for this agent", required: true, kind: "textarea", multiline: true, minLength: 12, maxLength: 1200 },
    ],
  },
};

export const BNB_RISK_PREFERENCES = ["Low", "Balanced", "Aggressive"] as const;

export function capabilityForBnbCategory(category: BnbAgentCategory): BnbJobCapability {
  if (category === "Rebalancing") return "rebalancing";
  if (category === "Grid Trading") return "grid_trading";
  if (category === "Health Factor Monitoring") return "health_factor";
  if (category === "Yield Optimisation") return "yield_optimisation";
  return "custom";
}

export function capabilityForBnbAgent(agent: Pick<BnbAgentProfile, "category" | "name" | "description" | "capabilities" | "services">): BnbJobCapability {
  const text = [
    agent.name,
    agent.description,
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type}`).join(" "),
  ].join(" ").toLowerCase();

  if (
    agent.category === "Rebalancing" &&
    (/\bv3\b/.test(text) || text.includes("concentrated liquidity") || (text.includes("liquidity") && text.includes("range")))
  ) {
    return "concentrated_liquidity";
  }

  return capabilityForBnbCategory(agent.category);
}

export function allowedBnbJobCapabilitiesForAgent(agent: Pick<BnbAgentProfile, "category" | "name" | "description" | "capabilities" | "services">): BnbJobCapability[] {
  return [capabilityForBnbAgent(agent)];
}

export function isBnbJobCapabilityAllowedForAgent(
  agent: Pick<BnbAgentProfile, "category" | "name" | "description" | "capabilities" | "services">,
  capability: string | null | undefined,
) {
  const requested = getBnbJobCapability(capability || capabilityForBnbAgent(agent)).capability;
  return allowedBnbJobCapabilitiesForAgent(agent).includes(requested);
}

export function unsupportedBnbJobCapabilityReason(
  agent: Pick<BnbAgentProfile, "category" | "name" | "description" | "capabilities" | "services">,
  capability: string | null | undefined,
) {
  const requested = getBnbJobCapability(capability || "").label;
  const allowed = allowedBnbJobCapabilitiesForAgent(agent).map((item) => getBnbJobCapability(item).label).join(", ");
  return `${agent.name} is configured for ${allowed}. It cannot run ${requested} jobs through Hive.`;
}

export function getBnbJobCapability(capability: string | null | undefined) {
  if (capability && capability in BNB_JOB_CAPABILITIES) {
    return BNB_JOB_CAPABILITIES[capability as BnbJobCapability];
  }
  return BNB_JOB_CAPABILITIES.custom;
}

function readIntentString(value: unknown, maxLength = 1200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function readField(fields: Record<string, unknown>, key: string) {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

export function validateBnbJobField(field: BnbJobFieldDefinition, rawValue: string) {
  const value = rawValue.trim();
  if (field.required && !value) return `${field.label} is required.`;
  if (!value) return "";

  if (field.minLength && value.length < field.minLength) return `${field.label} is too short.`;
  if (field.maxLength && value.length > field.maxLength) return `${field.label} is too long.`;

  if (field.kind === "select" && field.options && !field.options.includes(value)) {
    return `Choose a valid ${field.label.toLowerCase()}.`;
  }

  if (field.kind === "integer") {
    if (!/^\d+$/.test(value)) return `${field.label} must be a whole number.`;
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(field.min) && parsed < Number(field.min)) return `${field.label} is too low.`;
    if (Number.isFinite(field.max) && parsed > Number(field.max)) return `${field.label} is too high.`;
  }

  if (field.kind === "amount") {
    if (!/^\d+(?:\.\d{1,12})?$/.test(value)) return `${field.label} must be a positive number.`;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return `${field.label} must be greater than zero.`;
    if (Number.isFinite(field.min) && parsed < Number(field.min)) return `${field.label} is too low.`;
    if (Number.isFinite(field.max) && parsed > Number(field.max)) return `${field.label} is too high.`;
  }

  if (field.kind === "address_or_text" && value.startsWith("0x") && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return `${field.label} is not a valid EVM address.`;
  }

  return "";
}

export function validateOptionalBnbJobField(field: BnbJobFieldDefinition, rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";
  return validateBnbJobField({ ...field, required: false }, value);
}

export function buildBnbIntentJobSpec(input: BnbHireIntentInput): { ok: true; spec: BnbJobSpec; assumptions: string[]; warnings: string[]; missingInputs: string[] } | { ok: false; error: string } {
  const definition = getBnbJobCapability(input.capability);
  const outcome = readIntentString(input.outcome);
  if (outcome.length < 12) {
    return { ok: false, error: "Describe the result you want from this agent." };
  }

  const target = readIntentString(input.target, 240);
  if (target && target.length < 3) {
    return { ok: false, error: "Target is too short." };
  }

  const riskPreference = BNB_RISK_PREFERENCES.includes(input.riskPreference || "Balanced")
    ? input.riskPreference || "Balanced"
    : "Balanced";
  const taskType = input.taskType && definition.taskTypes.includes(input.taskType)
    ? input.taskType
    : definition.defaultTaskType;
  const instructions = readIntentString(input.instructions);
  const advancedFields = input.advancedFields && typeof input.advancedFields === "object" ? input.advancedFields : {};
  const fields: Record<string, string> = {
    outcome,
    riskPreference,
  };

  if (target) fields.intentTarget = target;

  for (const field of definition.fields) {
    const value = readField(advancedFields, field.key);
    const fieldError = validateOptionalBnbJobField(field, value);
    if (fieldError) return { ok: false, error: fieldError };
    if (value) fields[field.key] = value;
  }

  if (definition.capability === "health_factor") {
    const walletOrPosition = fields.walletOrPosition || target;
    if (!walletOrPosition) {
      return { ok: false, error: "Enter the wallet or lending position the agent should check." };
    }
    fields.walletOrPosition = walletOrPosition;
  }

  if (definition.capability === "yield_optimisation") {
    const yieldFields = normalizeYieldFields(fields, target);
    if (!yieldFields.ok) return yieldFields;
  }

  if (instructions.length > 1200) return { ok: false, error: "Notes are too long." };

  const boundsError = validatePriceBounds(definition.capability, fields);
  if (boundsError) {
    return { ok: false, error: boundsError };
  }

  const assumptions = [
    "Hive will use the agent's supported endpoint and available public BSC data.",
    ...(target ? [] : ["No target was supplied; the agent must infer the relevant wallet, pair, or position from the request."]),
    "No trading or fund movement happens until the user confirms a wallet transaction.",
  ];
  const warnings = [
    ...(riskPreference === "Aggressive" ? ["Aggressive risk allows wider recommendations, but payment release still requires user review."] : []),
  ];
  const missingInputs = target ? [] : ["Target wallet, pair, or position may be needed for a precise result."];
  const summary = [
    taskType,
    `Outcome: ${outcome}`,
    target ? definition.capability === "yield_optimisation" && fields.yieldSource === BNB_YIELD_SOURCE_CONNECTED_WALLET ? `Wallet: ${target}` : `Target: ${target}` : "",
    `Risk: ${riskPreference}`,
    ...summaryFieldsForJob(definition, fields).map((field) => {
      const value = fields[field.key];
      return value ? `${field.label}: ${value}` : "";
    }),
    ...(definition.capability === "yield_optimisation" && fields.yieldSource === BNB_YIELD_SOURCE_CONNECTED_WALLET ? ["Scope: All wallet assets"] : []),
    instructions ? `Notes: ${instructions}` : "",
  ].filter(Boolean).join("\n");

  return {
    ok: true,
    spec: {
      capability: definition.capability,
      taskType,
      summary,
      expectedOutput: definition.expectedOutput,
      fields,
      ...(instructions ? { instructions } : {}),
    },
    assumptions,
    warnings,
    missingInputs,
  };
}

export function withBnbWalletJobContext(spec: BnbJobSpec, walletAddress: string | undefined): BnbJobSpec {
  if (spec.capability !== "health_factor" || !walletAddress || !isEvmAddress(walletAddress)) return spec;
  const existingWallet = spec.fields.walletOrPosition || spec.fields.intentTarget;
  if (existingWallet) return spec;

  const fields = {
    ...spec.fields,
    walletOrPosition: walletAddress,
    intentTarget: walletAddress,
  };
  const nextSpec = {
    ...spec,
    fields,
  };

  return {
    ...nextSpec,
    summary: summarizeBnbJobSpec(nextSpec),
  };
}

export function buildBnbJobSpec(input: {
  capability?: string | null;
  taskType?: string | null;
  fields?: Record<string, unknown> | null;
  instructions?: string | null;
}): { ok: true; spec: BnbJobSpec } | { ok: false; error: string } {
  const definition = getBnbJobCapability(input.capability);
  const incomingFields = input.fields && typeof input.fields === "object" ? input.fields : {};
  const fields: Record<string, string> = {};

  for (const field of definition.fields) {
    const value = readField(incomingFields, field.key);
    const fieldError = validateBnbJobField(field, value);
    if (fieldError) return { ok: false, error: fieldError };
    if (value) fields[field.key] = value;
  }

  const instructions = typeof input.instructions === "string" ? input.instructions.trim() : "";
  if (instructions.length > 1200) return { ok: false, error: "Notes are too long." };
  const taskType = typeof input.taskType === "string" && input.taskType.trim() ? input.taskType.trim() : definition.defaultTaskType;
  if (!definition.taskTypes.includes(taskType)) return { ok: false, error: "Choose a valid task." };

  if (definition.capability === "yield_optimisation") {
    const yieldFields = normalizeYieldFields(fields, fields.intentTarget || "");
    if (!yieldFields.ok) return yieldFields;
  }

  const boundsError = validatePriceBounds(definition.capability, fields);
  if (boundsError) {
    return { ok: false, error: boundsError };
  }

  const summary = summarizeBnbJobSpec({
    capability: definition.capability,
    taskType,
    summary: "",
    expectedOutput: definition.expectedOutput,
    fields,
    ...(instructions ? { instructions } : {}),
  });

  return {
    ok: true,
    spec: {
      capability: definition.capability,
      taskType,
      summary,
      expectedOutput: definition.expectedOutput,
      fields,
      ...(instructions ? { instructions } : {}),
    },
  };
}

function normalizeYieldFields(fields: Record<string, string>, target: string): { ok: true } | { ok: false; error: string } {
  const source = fields.yieldSource || (target && isEvmAddress(target) ? BNB_YIELD_SOURCE_CONNECTED_WALLET : BNB_YIELD_SOURCE_SELECTED_ASSET);
  if (!BNB_YIELD_SOURCE_OPTIONS.includes(source as (typeof BNB_YIELD_SOURCE_OPTIONS)[number])) {
    return { ok: false, error: "Choose whether this yield job should use your connected wallet or a selected asset." };
  }

  fields.yieldSource = source;

  if (source === BNB_YIELD_SOURCE_CONNECTED_WALLET) {
    const walletAddress = fields.walletAddress || (isEvmAddress(target) ? target : "");
    if (!walletAddress) {
      return { ok: false, error: "Connect a wallet to review current yield positions." };
    }
    fields.walletAddress = walletAddress;
    fields.intentTarget = walletAddress;
    return { ok: true };
  }

  const asset = fields.asset || (!isEvmAddress(target) ? target : "");
  if (!asset) {
    return { ok: false, error: "Choose the asset this yield job should use." };
  }
  if (!BNB_YIELD_ASSETS.includes(asset as (typeof BNB_YIELD_ASSETS)[number])) {
    return { ok: false, error: "Choose a supported asset or enter a custom token address." };
  }
  fields.asset = asset;

  if (asset === BNB_CUSTOM_TOKEN_OPTION) {
    if (!isEvmAddress(fields.customAsset || "")) {
      return { ok: false, error: "Enter a valid token address." };
    }
    fields.intentTarget = fields.customAsset;
    return { ok: true };
  }

  fields.intentTarget = asset;
  return { ok: true };
}

function isEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function validateBnbJobPriceBounds(capability: BnbJobCapability, fields: Record<string, string>) {
  return validatePriceBounds(capability, fields);
}

function validatePriceBounds(capability: BnbJobCapability, fields: Record<string, string>) {
  if (capability === "grid_trading") {
    const lower = Number.parseFloat(fields.lowerBound || "");
    const upper = Number.parseFloat(fields.upperBound || "");
    if (Number.isFinite(lower) && Number.isFinite(upper) && upper <= lower) {
      return "Upper bound must be higher than lower bound.";
    }
  }

  if (capability === "concentrated_liquidity") {
    const lower = Number.parseFloat(fields.lowerPrice || "");
    const upper = Number.parseFloat(fields.upperPrice || "");
    if (Number.isFinite(lower) && Number.isFinite(upper) && upper <= lower) {
      return "Upper price must be higher than lower price.";
    }
  }

  return "";
}

export function legacyBnbJobSpec(taskTemplate: string, taskDetails: string): BnbJobSpec {
  const summary = [taskTemplate || "Custom task", taskDetails].filter(Boolean).join(": ");
  return {
    capability: "custom",
    taskType: taskTemplate || "Custom task",
    summary,
    expectedOutput: "Agent result and work record",
    fields: {
      request: summary,
    },
    ...(taskDetails ? { instructions: taskDetails } : {}),
  };
}

export function summarizeBnbJobSpec(spec: BnbJobSpec) {
  const definition = getBnbJobCapability(spec.capability);
  const lines = summaryFieldsForJob(definition, spec.fields)
    .map((field) => {
      const value = spec.fields[field.key];
      return value ? `${field.label}: ${value}` : "";
    })
    .filter(Boolean);

  if (spec.capability === "yield_optimisation" && spec.fields.yieldSource === BNB_YIELD_SOURCE_CONNECTED_WALLET) {
    if (spec.fields.walletAddress) lines.unshift(`Wallet: ${spec.fields.walletAddress}`);
    lines.push("Scope: All wallet assets");
  }
  if (spec.instructions) lines.push(`Notes: ${spec.instructions}`);
  return [spec.taskType, ...lines].join("\n");
}

function summaryFieldsForJob(definition: BnbJobCapabilityDefinition, fields: Record<string, string>) {
  return definition.fields.filter((field) => {
    if (field.key === "riskPreference") return false;
    if (definition.capability !== "yield_optimisation") return true;
    if (field.key === "yieldSource") return false;
    if (fields.yieldSource === BNB_YIELD_SOURCE_CONNECTED_WALLET) {
      return field.key !== "asset" && field.key !== "customAsset";
    }
    if (field.key === "customAsset") return fields.asset === BNB_CUSTOM_TOKEN_OPTION;
    return true;
  });
}
