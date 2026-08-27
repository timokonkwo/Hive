import {
  bnbJobCapabilityForEndpointContract,
  humanizeEndpointCapabilityName,
  isActionableBnbEndpointCapability,
  normalizedEndpointCapabilityName,
} from "@/lib/bnb/capability-contracts";
import type {
  BnbAgentCategory,
  BnbAgentProfile,
  BnbEndpointCapabilityContract,
  BnbHireIntentInput,
  BnbJobCapability,
  BnbJobSpec,
} from "@/lib/bnb/types";

export type BnbJobFieldKind = "text" | "textarea" | "select" | "amount" | "integer" | "address" | "address_or_text" | "json";

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
  taskLabels?: Record<string, string>;
  expectedOutput: string;
  fields: BnbJobFieldDefinition[];
  schemaDerived?: boolean;
  endpointCapabilities?: Record<string, BnbEndpointCapabilityContract>;
};

export const BNB_YIELD_SOURCE_CONNECTED_WALLET = "Connected wallet";
export const BNB_YIELD_SOURCE_SELECTED_ASSET = "Selected asset";
export const BNB_YIELD_SOURCE_OPTIONS = [BNB_YIELD_SOURCE_CONNECTED_WALLET, BNB_YIELD_SOURCE_SELECTED_ASSET] as const;
export const BNB_CUSTOM_TOKEN_OPTION = "Custom token address";
export const BNB_YIELD_ASSETS = ["BNB", "WBNB", "USDT", "USDC", "BTCB", "ETH", "CAKE", BNB_CUSTOM_TOKEN_OPTION] as const;
export const BNB_HEALTH_PROTOCOLS = ["Venus", "Lista", "Aave"] as const;
export const BNB_YIELD_PROTOCOLS = ["PancakeSwap", "Venus", "Lista", "Aave"] as const;
export const BNB_V3_DEXES = ["PancakeSwap", "Uniswap", "WAGMI", "OkuTrade"] as const;
const BNB_V3_DISCOVERY_TASK = "Check V3 DEX support";
const BNB_V3_PRICE_TASK = "Check V3 pool price";
const BNB_V3_RANGE_TASK = "Get predefined V3 range";
const BNB_V3_ESTIMATE_TASK = "Estimate V3 position amounts";
const BNB_V3_POSITION_TASK = "Prepare V3 liquidity position";

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
    defaultTaskType: BNB_V3_DISCOVERY_TASK,
    taskTypes: [BNB_V3_DISCOVERY_TASK, BNB_V3_PRICE_TASK, BNB_V3_RANGE_TASK, BNB_V3_ESTIMATE_TASK, BNB_V3_POSITION_TASK],
    expectedOutput: "Validated V3 liquidity parameters, approval checks, and execution notes",
    fields: [
      { key: "token0", label: "Token 0", placeholder: "0x... or token symbol", required: true, kind: "address_or_text", minLength: 2, maxLength: 120 },
      { key: "token1", label: "Token 1", placeholder: "0x... or token symbol", required: true, kind: "address_or_text", minLength: 2, maxLength: 120 },
      { key: "amount0", label: "Token 0 amount", placeholder: "1.5", required: true, kind: "amount", min: 0, maxLength: 32 },
      { key: "amount1", label: "Token 1 amount", placeholder: "250", required: true, kind: "amount", min: 0, maxLength: 32 },
      { key: "fee", label: "Fee tier", placeholder: "Select fee tier", required: true, kind: "select", options: ["100", "500", "2500", "3000", "10000"], helper: "Uniswap/Pancake V3 fee tier in hundredths of a bip." },
      { key: "lowerPrice", label: "Lower price", placeholder: "580", required: true, kind: "amount", min: 0, maxLength: 32 },
      { key: "upperPrice", label: "Upper price", placeholder: "720", required: true, kind: "amount", min: 0, maxLength: 32 },
      { key: "shortcut", label: "Range", placeholder: "Select range", required: true, kind: "select", options: ["safe", "wide", "risky"] },
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
    expectedOutput: "Ranked yield routes with risk notes",
    fields: [
      { key: "yieldSource", label: "Source", placeholder: "Select source", required: true, kind: "select", options: BNB_YIELD_SOURCE_OPTIONS },
      { key: "asset", label: "Asset", placeholder: "Select asset", required: false, kind: "select", options: BNB_YIELD_ASSETS },
      { key: "customAsset", label: "Token address", placeholder: "0x...", required: false, kind: "address_or_text", minLength: 42, maxLength: 42 },
      { key: "amount", label: "Amount", placeholder: "250", required: false, kind: "amount", min: 0, maxLength: 32 },
      { key: "protocols", label: "Protocol", placeholder: "Select protocol", required: true, kind: "select", options: BNB_YIELD_PROTOCOLS },
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
      { key: "protocol", label: "Protocol", placeholder: "Select protocol", required: true, kind: "select", options: BNB_HEALTH_PROTOCOLS },
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

export type BnbAgentCapabilitySource = Pick<
  BnbAgentProfile,
  "category" | "name" | "description" | "capabilities" | "services" | "sourceMetrics" | "endpointCapabilities" | "hasActionableEndpointCapabilities"
>;

export function capabilityForBnbCategory(category: BnbAgentCategory): BnbJobCapability {
  if (category === "Rebalancing") return "rebalancing";
  if (category === "Grid Trading") return "grid_trading";
  if (category === "Health Factor Monitoring") return "health_factor";
  if (category === "Yield Optimisation") return "yield_optimisation";
  return "custom";
}

export function capabilityForBnbAgent(agent: BnbAgentCapabilitySource): BnbJobCapability {
  const text = [
    agent.name,
    agent.description,
    agent.capabilities.join(" "),
    agent.services.map((service) => `${service.name} ${service.type}`).join(" "),
    agent.sourceMetrics?.supportedProtocols?.join(" ") || "",
  ].join(" ").toLowerCase();

  if (
    /\bv3\b/.test(text) ||
    text.includes("concentrated liquidity") ||
    text.includes("tick spacing") ||
    (text.includes("liquidity") && text.includes("range"))
  ) {
    return "concentrated_liquidity";
  }

  if (agent.category === "Health Factor Monitoring" || /\b(?:health\s*factor|liquidation|borrow\s*position|lending\s*position)\b/.test(text)) {
    return "health_factor";
  }

  if (agent.category === "Grid Trading" || /\b(?:grid|grid\s*trading|bounds|trading\s*range)\b/.test(text)) {
    return "grid_trading";
  }

  if (agent.category === "Yield Optimisation" || /\b(?:yield|apy|apr|vault|farm|staking|deposit|earn)\b/.test(text)) {
    return "yield_optimisation";
  }

  return capabilityForBnbCategory(agent.category);
}

export function allowedBnbJobCapabilitiesForAgent(agent: BnbAgentCapabilitySource): BnbJobCapability[] {
  const contractDefinitions = endpointCapabilityDefinitionsForAgent(agent);
  if (agent.endpointCapabilities && agent.endpointCapabilities.length > 0) {
    return contractDefinitions.map((definition) => definition.capability);
  }
  if (agent.hasActionableEndpointCapabilities === false) return [];
  return [capabilityForBnbAgent(agent)];
}

export function isBnbJobCapabilityAllowedForAgent(
  agent: BnbAgentCapabilitySource,
  capability: string | null | undefined,
) {
  const requested = getBnbJobCapability(capability || capabilityForBnbAgent(agent)).capability;
  return allowedBnbJobCapabilitiesForAgent(agent).includes(requested);
}

export function unsupportedBnbJobCapabilityReason(
  agent: BnbAgentCapabilitySource,
  capability: string | null | undefined,
) {
  const requested = getBnbJobCapability(capability || "").label;
  const allowed = allowedBnbJobCapabilitiesForAgent(agent).map((item) => getBnbJobCapability(item).label).join(", ");
  if (!allowed) return `${agent.name} is not available for jobs.`;
  return `${agent.name} supports ${allowed}. It cannot run ${requested} jobs.`;
}

export function getBnbJobCapability(capability: string | null | undefined) {
  if (capability && capability in BNB_JOB_CAPABILITIES) {
    return BNB_JOB_CAPABILITIES[capability as BnbJobCapability];
  }
  return BNB_JOB_CAPABILITIES.custom;
}

export function getBnbAgentJobCapability(
  agent: BnbAgentCapabilitySource,
  capability: string | null | undefined,
  taskType?: string | null,
) {
  const requested = getBnbJobCapability(capability || capabilityForBnbAgent(agent));
  const allowed = allowedBnbJobCapabilitiesForAgent(agent);
  const contractDefinition = endpointCapabilityDefinitionForAgent(agent, requested.capability, taskType);
  if (contractDefinition) return contractDefinition;
  if (allowed.length === 0) return emptyBnbJobDefinition(requested.capability);
  const base = allowed.includes(requested.capability) ? requested : getBnbJobCapability(allowed[0]);
  return refineBnbJobDefinitionForAgent(base, agent);
}

export function hasUsableBnbEndpointCapabilities(agent: BnbAgentCapabilitySource) {
  if (agent.endpointCapabilities && agent.endpointCapabilities.length > 0) {
    return endpointCapabilityDefinitionsForAgent(agent).length > 0;
  }
  return agent.hasActionableEndpointCapabilities !== false;
}

export function bnbJobTaskLabel(definition: BnbJobCapabilityDefinition, taskType: string) {
  return definition.taskLabels?.[taskType] || humanizeEndpointCapabilityName(taskType);
}

export function getBnbJobSpecDefinition(spec: BnbJobSpec): BnbJobCapabilityDefinition {
  const base = getBnbJobCapability(spec.capability);
  if (!spec.endpointCapability) return base;
  return {
    ...base,
    defaultTaskType: spec.taskType,
    taskTypes: [spec.taskType],
    taskLabels: { [spec.taskType]: humanizeEndpointCapabilityName(spec.endpointCapability.name) },
    expectedOutput: spec.expectedOutput,
    fields: endpointCapabilityFields(spec.endpointCapability, spec.capability),
    schemaDerived: true,
    endpointCapabilities: { [spec.taskType]: spec.endpointCapability },
  };
}

function endpointCapabilityDefinitionForAgent(
  agent: BnbAgentCapabilitySource,
  capability: BnbJobCapability,
  taskType?: string | null,
) {
  const definition = endpointCapabilityDefinitionsForAgent(agent)
    .find((item) => item.capability === capability);
  return definition ? refineEndpointCapabilityDefinition(definition, taskType) : null;
}

function endpointCapabilityDefinitionsForAgent(agent: BnbAgentCapabilitySource): BnbJobCapabilityDefinition[] {
  const contracts = uniqueEndpointCapabilities(agent.endpointCapabilities || [])
    .filter(isActionableBnbEndpointCapability);
  if (contracts.length === 0) return [];

  const grouped = new Map<BnbJobCapability, BnbEndpointCapabilityContract[]>();
  for (const contract of contracts) {
    const capability = bnbJobCapabilityForEndpointContract(contract);
    const items = grouped.get(capability) || [];
    items.push(contract);
    grouped.set(capability, items);
  }

  return Array.from(grouped.entries()).map(([capability, items]) => {
    const base = getBnbJobCapability(capability);
    const taskTypes = items.map((item) => item.name);
    const taskLabels = Object.fromEntries(items.map((item) => [item.name, humanizeEndpointCapabilityName(item.name)]));
    const endpointCapabilities = Object.fromEntries(items.map((item) => [item.name, item]));
    const selected = items[0];
    return {
      ...base,
      defaultTaskType: taskTypes[0] || base.defaultTaskType,
      taskTypes,
      taskLabels,
      expectedOutput: `${humanizeEndpointCapabilityName(selected.name)} result`,
      fields: endpointCapabilityFields(selected, capability),
      schemaDerived: true,
      endpointCapabilities,
    };
  });
}

function refineEndpointCapabilityDefinition(
  definition: BnbJobCapabilityDefinition,
  taskType?: string | null,
): BnbJobCapabilityDefinition {
  if (!definition.schemaDerived || !definition.endpointCapabilities) return definition;
  const selectedTask = taskType && definition.taskTypes.includes(taskType)
    ? taskType
    : definition.defaultTaskType;
  const contract = definition.endpointCapabilities[selectedTask] || definition.endpointCapabilities[definition.defaultTaskType];
  if (!contract) return definition;
  return {
    ...definition,
    defaultTaskType: definition.defaultTaskType,
    expectedOutput: `${humanizeEndpointCapabilityName(contract.name)} result`,
    fields: endpointCapabilityFields(contract, definition.capability),
  };
}

function emptyBnbJobDefinition(capability: BnbJobCapability): BnbJobCapabilityDefinition {
  const base = getBnbJobCapability(capability);
  return {
    ...base,
    taskTypes: [],
    fields: [],
  };
}

function endpointCapabilityForTask(
  definition: BnbJobCapabilityDefinition,
  taskType: string,
  requestedName?: string,
) {
  if (!definition.schemaDerived || !definition.endpointCapabilities) return null;
  const requestedKey = requestedName ? normalizedEndpointCapabilityName(requestedName) : "";
  if (requestedKey) {
    const requested = Object.values(definition.endpointCapabilities)
      .find((contract) => normalizedEndpointCapabilityName(contract.name) === requestedKey);
    if (requested) return requested;
  }
  return definition.endpointCapabilities[taskType] || definition.endpointCapabilities[definition.defaultTaskType] || null;
}

function uniqueEndpointCapabilities(contracts: BnbEndpointCapabilityContract[]) {
  const byName = new Map<string, BnbEndpointCapabilityContract>();
  for (const contract of contracts) {
    const key = `${contract.kind}:${normalizedEndpointCapabilityName(contract.name)}`;
    if (!key || key === `${contract.kind}:`) continue;
    const previous = byName.get(key);
    if (!previous || (!previous.inputSchema && contract.inputSchema)) byName.set(key, contract);
  }
  return Array.from(byName.values()).slice(0, 40);
}

function endpointCapabilityFields(contract: BnbEndpointCapabilityContract, capability: BnbJobCapability): BnbJobFieldDefinition[] {
  const schema = jsonSchemaObject(contract.inputSchema);
  const properties = schemaProperties(schema);
  const required = schemaRequired(schema);
  const fields = Object.entries(properties)
    .slice(0, 16)
    .map(([key, property]) => schemaPropertyField(key, property, required.includes(key)))
    .filter((field): field is BnbJobFieldDefinition => Boolean(field));
  if (fields.length > 0) return fields;
  if (capability === "custom") {
    return BNB_JOB_CAPABILITIES.custom.fields;
  }
  return [];
}

function schemaPropertyField(key: string, property: Record<string, unknown>, required: boolean): BnbJobFieldDefinition | null {
  const label = schemaLabel(key, property);
  const enumValues = schemaTypeIncludes(property, "boolean") ? ["true", "false"] : schemaEnumValues(property);
  const kind = schemaFieldKind(key, property, enumValues);
  const maxLength = schemaNumber(property.maxLength, kind === "json" ? 5000 : kind === "address" ? 42 : kind === "textarea" ? 1200 : 240);
  const minLength = schemaNumber(property.minLength, kind === "address" ? 42 : undefined);
  const min = schemaNumber(property.minimum ?? property.exclusiveMinimum, undefined);
  const max = schemaNumber(property.maximum ?? property.exclusiveMaximum, undefined);
  const multiline = kind === "textarea" || kind === "json";

  return {
    key,
    label,
    placeholder: schemaPlaceholder(label, kind),
    required,
    kind,
    multiline,
    ...(enumValues.length > 0 ? { options: enumValues } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(minLength !== undefined ? { minLength } : {}),
    maxLength,
  };
}

function schemaFieldKind(key: string, property: Record<string, unknown>, enumValues: string[]): BnbJobFieldKind {
  if (enumValues.length > 0 || schemaTypeIncludes(property, "boolean")) return "select";
  if (schemaTypeIncludes(property, "integer")) return "integer";
  if (schemaTypeIncludes(property, "number")) return "amount";
  if (schemaTypeIncludes(property, "object")) return "json";
  if (schemaTypeIncludes(property, "array")) return schemaEnumValues(asRecord(property.items)).length > 0 ? "select" : "textarea";
  if (isAddressSchemaField(key, property)) return "address";
  if (schemaText(property).length > 160 || /instructions?|notes?|description|request|prompt|query|message|task/i.test(key)) return "textarea";
  return "text";
}

function schemaPlaceholder(label: string, kind: BnbJobFieldKind) {
  if (kind === "select") return `Select ${label.toLowerCase()}`;
  if (kind === "address") return "0x...";
  if (kind === "amount") return "0.0";
  if (kind === "integer") return "0";
  if (kind === "json") return "{}";
  return `Enter ${label.toLowerCase()}`;
}

function schemaLabel(key: string, property: Record<string, unknown>) {
  const title = typeof property.title === "string" ? property.title.trim() : "";
  if (title) return title;
  return humanizeEndpointCapabilityName(key)
    .replace(/\bId\b/g, "ID")
    .replace(/\bUrl\b/g, "URL");
}

function jsonSchemaObject(value: unknown) {
  const schema = asRecord(value);
  if (schema.properties || schema.type === "object") return schema;
  for (const key of ["inputSchema", "input_schema", "parameters", "schema", "jsonSchema", "json_schema"]) {
    const nested = asRecord(schema[key]);
    if (nested.properties || nested.type === "object") return nested;
  }
  return schema;
}

function schemaProperties(schema: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(asRecord(schema.properties))
      .map(([key, value]) => [key, asRecord(value)])
      .filter(([key]) => typeof key === "string" && key.length > 0),
  ) as Record<string, Record<string, unknown>>;
}

function schemaRequired(schema: Record<string, unknown>) {
  return Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : [];
}

function schemaEnumValues(property: Record<string, unknown>): string[] {
  const itemSchema = asRecord(property.items);
  const values: unknown[] = [
    ...(Array.isArray(property.enum) ? property.enum : []),
    ...(Array.isArray(itemSchema.enum) ? itemSchema.enum : []),
    ...schemaVariants(property).flatMap((variant) => schemaEnumValues(variant)),
  ];
  return Array.from(new Set(values.map((value) => String(value)).filter(Boolean))).slice(0, 60);
}

function schemaTypeIncludes(property: Record<string, unknown>, expected: string): boolean {
  const type = property.type;
  if (type === expected) return true;
  if (Array.isArray(type) && type.includes(expected)) return true;
  return schemaVariants(property).some((variant) => schemaTypeIncludes(variant, expected));
}

function schemaVariants(property: Record<string, unknown>): Record<string, unknown>[] {
  return ["anyOf", "oneOf", "allOf"]
    .flatMap((key) => Array.isArray(property[key]) ? property[key] as unknown[] : [])
    .map(asRecord);
}

function schemaNumber(value: unknown, fallback: number | undefined) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(number) ? number : fallback;
}

function schemaText(property: Record<string, unknown>) {
  return [
    property.title,
    property.description,
  ].filter((value): value is string => typeof value === "string").join(" ");
}

function isAddressSchemaField(key: string, property: Record<string, unknown>) {
  const text = `${key} ${schemaText(property)} ${property.format || ""}`.toLowerCase();
  return /(?:^|[^a-z])(address|wallet|account|owner|useraddress|recipient)(?:[^a-z]|$)/.test(text)
    || property.format === "ethereum-address";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export function supportedBnbProtocolsForAgent(agent: BnbAgentCapabilitySource, capability: BnbJobCapability) {
  const protocols = uniqueStrings([
    ...(agent.sourceMetrics?.supportedProtocols || []),
    ...agent.services.flatMap((service) => [service.name, service.type]),
    ...agent.capabilities,
    agent.name,
    agent.description,
  ].flatMap((value) => detectNamedProtocols(value)));

  if (capability === "health_factor") {
    const lending = protocols.filter((protocol) => BNB_HEALTH_PROTOCOLS.includes(protocol as (typeof BNB_HEALTH_PROTOCOLS)[number]));
    return lending.length > 0 ? lending : [...BNB_HEALTH_PROTOCOLS];
  }

  if (capability === "yield_optimisation") {
    const yieldProtocols = protocols.filter((protocol) => BNB_YIELD_PROTOCOLS.includes(protocol as (typeof BNB_YIELD_PROTOCOLS)[number]));
    return yieldProtocols.length > 0 ? yieldProtocols : [...BNB_YIELD_PROTOCOLS];
  }

  if (capability === "concentrated_liquidity" || capability === "rebalancing") {
    const dexes = protocols.filter((protocol) => BNB_V3_DEXES.includes(protocol as (typeof BNB_V3_DEXES)[number]));
    return dexes.length > 0 ? dexes : [...BNB_V3_DEXES];
  }

  return protocols;
}

function refineBnbJobDefinitionForAgent(definition: BnbJobCapabilityDefinition, agent: BnbAgentCapabilitySource): BnbJobCapabilityDefinition {
  if (definition.capability === "health_factor") {
    const protocols = supportedBnbProtocolsForAgent(agent, definition.capability);
    return replaceField(definition, "protocol", { options: protocols, placeholder: protocols.length === 1 ? protocols[0] : "Select protocol" });
  }

  if (definition.capability === "yield_optimisation") {
    const protocols = supportedBnbProtocolsForAgent(agent, definition.capability);
    return replaceField(definition, "protocols", { options: protocols, placeholder: protocols.length === 1 ? protocols[0] : "Select protocol" });
  }

  if (definition.capability === "concentrated_liquidity") {
    const dexes = supportedBnbProtocolsForAgent(agent, definition.capability);
    return replaceField(definition, "dex", { options: ["Auto", ...dexes] });
  }

  return definition;
}

function replaceField(
  definition: BnbJobCapabilityDefinition,
  key: string,
  patch: Partial<BnbJobFieldDefinition>,
): BnbJobCapabilityDefinition {
  return {
    ...definition,
    fields: definition.fields.map((field) => field.key === key ? { ...field, ...patch } : field),
  };
}

function detectNamedProtocols(value: string) {
  const text = value.toLowerCase();
  const protocols: string[] = [];
  if (/\bpancake(?:swap)?\b/.test(text)) protocols.push("PancakeSwap");
  if (/\bvenus\b/.test(text)) protocols.push("Venus");
  if (/\blista\b/.test(text)) protocols.push("Lista");
  if (/\baave\b/.test(text)) protocols.push("Aave");
  if (/\buniswap\b/.test(text)) protocols.push("Uniswap");
  if (/\bwagmi\b/.test(text)) protocols.push("WAGMI");
  if (/\boku(?:trade)?\b/.test(text)) protocols.push("OkuTrade");
  return protocols;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function v3TaskFieldKeys(taskType: string) {
  if (taskType === BNB_V3_DISCOVERY_TASK) return [];
  if (taskType === BNB_V3_PRICE_TASK) return ["token0", "token1", "fee"];
  if (taskType === BNB_V3_RANGE_TASK) return ["token0", "token1", "fee", "shortcut"];
  if (taskType === BNB_V3_ESTIMATE_TASK || taskType === BNB_V3_POSITION_TASK) {
    return ["token0", "token1", "amount0", "amount1", "fee", "lowerPrice", "upperPrice"];
  }
  return ["token0", "token1", "amount0", "amount1", "fee", "lowerPrice", "upperPrice"];
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

  if (field.kind === "address" && !isEvmAddress(value)) {
    return `${field.label} is not a valid EVM address.`;
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

  if (field.kind === "json") {
    try {
      JSON.parse(value);
    } catch {
      return `${field.label} must be valid JSON.`;
    }
  }

  return "";
}

export function validateOptionalBnbJobField(field: BnbJobFieldDefinition, rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";
  return validateBnbJobField({ ...field, required: false }, value);
}

export function visibleBnbJobFields(
  definition: BnbJobCapabilityDefinition,
  options: { fields?: Record<string, string>; taskType?: string } = {},
) {
  if (definition.schemaDerived) return definition.fields;
  return definition.fields.filter((field) => {
    if (field.key === "riskPreference") return false;
    if (definition.capability === "concentrated_liquidity") {
      return v3TaskFieldKeys(options.taskType || definition.defaultTaskType).includes(field.key);
    }
    if (definition.capability !== "yield_optimisation") return true;
    const fields = options.fields || {};
    const taskType = options.taskType || definition.defaultTaskType;
    const connectedWallet = yieldBnbJobUsesConnectedWallet(taskType, fields);
    if (field.key === "yieldSource") return false;
    if (field.key === "asset") return !connectedWallet;
    if (field.key === "customAsset") return !connectedWallet && fields.asset === BNB_CUSTOM_TOKEN_OPTION;
    return true;
  });
}

export function summaryBnbJobFields(
  definition: BnbJobCapabilityDefinition,
  fields: Record<string, string>,
  taskType: string,
  walletAddress?: string,
) {
  return visibleBnbJobFields(definition, { fields, taskType }).filter((field) => {
    if (definition.schemaDerived) return true;
    if (definition.capability !== "yield_optimisation") return true;
    if (yieldBnbJobUsesConnectedWallet(taskType, fields)) return field.key !== "asset" && field.key !== "customAsset";
    if (field.key === "customAsset") return fields.asset === BNB_CUSTOM_TOKEN_OPTION;
    return field.key !== "yieldSource" && !(field.key === "walletAddress" && !walletAddress);
  });
}

export function isBnbJobFieldRequired(
  capability: BnbJobCapability,
  taskType: string,
  fields: Record<string, string>,
  field: BnbJobFieldDefinition,
) {
  if (field.required) return true;
  if (capability === "concentrated_liquidity") {
    return v3TaskFieldKeys(taskType).includes(field.key);
  }
  if (capability !== "yield_optimisation" || yieldBnbJobUsesConnectedWallet(taskType, fields)) return false;
  if (field.key === "asset") return true;
  return field.key === "customAsset" && fields.asset === BNB_CUSTOM_TOKEN_OPTION;
}

export function initialBnbJobFieldValue(field: BnbJobFieldDefinition, capability?: BnbJobCapability, taskType?: string) {
  if (capability === "yield_optimisation") {
    if (field.key === "yieldSource") return defaultBnbYieldSource(taskType || "");
    if (field.key === "asset") return defaultBnbYieldAsset(taskType || "");
  }
  if (capability === "concentrated_liquidity" && field.key === "shortcut") return "safe";
  if (field.kind !== "select" || !field.required || !field.options?.length) return "";
  if (field.key === "threshold") return field.options.includes("1.4") ? "1.4" : field.options[0];
  return field.options[0];
}

export function applyBnbJobFieldDefaults(capability: BnbJobCapability, taskType: string, current: Record<string, string>) {
  const next: Record<string, string> = { ...current };
  const definition = getBnbJobCapability(capability);
  for (const field of definition.fields) {
    if (!next[field.key]) next[field.key] = initialBnbJobFieldValue(field, capability, taskType);
  }

  if (capability !== "yield_optimisation") return next;
  const source = defaultBnbYieldSource(taskType);
  next.yieldSource = source;
  if (source === BNB_YIELD_SOURCE_SELECTED_ASSET && !next.asset) {
    next.asset = defaultBnbYieldAsset(taskType);
  }
  return next;
}

export function applyBnbJobDefinitionFieldDefaults(
  definition: BnbJobCapabilityDefinition,
  taskType: string,
  current: Record<string, string>,
) {
  const next: Record<string, string> = {};
  for (const field of definition.fields) {
    next[field.key] = current[field.key] || initialBnbJobFieldValue(field, definition.capability, taskType);
  }
  if (definition.schemaDerived) return next;
  return applyBnbJobFieldDefaults(definition.capability, taskType, next);
}

export function bnbJobFieldValue({
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
  const value = fields[field.key] || "";
  if (value) return value;
  if (capability === "health_factor" && field.key === "walletOrPosition" && walletAddress) return walletAddress;
  if (walletAddress && isWalletAddressJobField(field)) return walletAddress;
  return "";
}

export function defaultBnbIntentTarget(capability: BnbJobCapability, fields: Record<string, string>, walletAddress?: string) {
  if (capability === "health_factor") return fields.walletOrPosition || walletAddress || "";
  if (capability === "yield_optimisation") {
    if (yieldBnbJobUsesConnectedWallet("", fields)) return fields.walletAddress || walletAddress || "";
    if (fields.asset === BNB_CUSTOM_TOKEN_OPTION) return fields.customAsset || "";
    return fields.asset || "";
  }
  if (capability === "grid_trading") return fields.pair || "";
  if (capability === "concentrated_liquidity") return [fields.token0, fields.token1].filter(Boolean).join("/");
  if (capability === "rebalancing") return fields.poolOrPair || fields.position || "";
  return fields.request || "";
}

export function yieldBnbJobUsesConnectedWallet(taskType: string, fields: Record<string, string>) {
  const source = fields.yieldSource || defaultBnbYieldSource(taskType);
  return source === BNB_YIELD_SOURCE_CONNECTED_WALLET;
}

export function defaultBnbYieldSource(taskType: string) {
  return taskType === "Review current yield position" ? BNB_YIELD_SOURCE_CONNECTED_WALLET : BNB_YIELD_SOURCE_SELECTED_ASSET;
}

export function defaultBnbYieldAsset(taskType: string) {
  return taskType === "Compare yield routes" ? "BNB" : "USDT";
}

export function validateBnbYieldFields(
  capability: BnbJobCapability,
  taskType: string,
  fields: Record<string, string>,
  walletAddress?: string,
) {
  if (capability !== "yield_optimisation") return { field: "", error: "" };

  if (yieldBnbJobUsesConnectedWallet(taskType, fields)) {
    return walletAddress ? { field: "", error: "" } : { field: "yieldSource", error: "Connect a wallet to review current yield positions." };
  }

  if (!fields.asset) {
    return { field: "asset", error: "Choose the asset this yield job should use." };
  }

  if (fields.asset === BNB_CUSTOM_TOKEN_OPTION && !/^0x[a-fA-F0-9]{40}$/.test(fields.customAsset || "")) {
    return { field: "customAsset", error: "Enter a valid token address." };
  }

  return { field: "", error: "" };
}

function validateBnbJobDefinitionFields(definition: BnbJobCapabilityDefinition, taskType: string, fields: Record<string, string>) {
  for (const field of visibleBnbJobFields(definition, { fields, taskType })) {
    const required = definition.schemaDerived
      ? field.required
      : isBnbJobFieldRequired(definition.capability, taskType, fields, field);
    const value = fields[field.key] || "";
    const fieldError = required
      ? validateBnbJobField({ ...field, required: true }, value)
      : validateOptionalBnbJobField(field, value);
    if (fieldError) return fieldError;
  }

  return "";
}

export function buildBnbIntentJobSpec(input: BnbHireIntentInput, agent?: BnbAgentCapabilitySource): { ok: true; spec: BnbJobSpec; assumptions: string[]; warnings: string[]; missingInputs: string[] } | { ok: false; error: string } {
  const definition = agent ? getBnbAgentJobCapability(agent, input.capability, input.taskType) : getBnbJobCapability(input.capability);
  const advancedFields = input.advancedFields && typeof input.advancedFields === "object" ? input.advancedFields : {};
  const request = readField(advancedFields, "request");
  const rawOutcome = readIntentString(input.outcome);
  const taskType = input.taskType && definition.taskTypes.includes(input.taskType)
    ? input.taskType
    : definition.defaultTaskType;
  const endpointCapability = endpointCapabilityForTask(definition, taskType, input.endpointCapability);
  const outcome = definition.schemaDerived && !rawOutcome
    ? `Run ${bnbJobTaskLabel(definition, taskType)} and return the result.`
    : definition.capability === "custom" && !rawOutcome
      ? request
      : rawOutcome;
  if (!definition.schemaDerived && outcome.length < 12) {
    return { ok: false, error: "Describe the result you want from this agent." };
  }

  const target = readIntentString(input.target, 240);
  if (target && target.length < 3) {
    return { ok: false, error: "Target is too short." };
  }

  const riskPreference = BNB_RISK_PREFERENCES.includes(input.riskPreference || "Balanced")
    ? input.riskPreference || "Balanced"
    : "Balanced";
  const instructions = readIntentString(input.instructions);
  const fields: Record<string, string> = {
    ...(definition.capability === "custom" || definition.schemaDerived ? {} : { outcome }),
    riskPreference,
  };

  if (target) fields.intentTarget = target;
  if (definition.capability === "yield_optimisation" && !definition.schemaDerived) fields.yieldSource = defaultBnbYieldSource(taskType);

  for (const field of definition.fields) {
    const value = readField(advancedFields, field.key);
    const fieldError = validateOptionalBnbJobField(field, value);
    if (fieldError) return { ok: false, error: fieldError };
    if (value) fields[field.key] = value;
  }

  const walletAddress = readField(advancedFields, "walletAddress");
  if (isEvmAddress(walletAddress)) fields.walletAddress = walletAddress;
  applyWalletFieldDefaults(definition, fields, walletAddress);

  if (definition.capability === "health_factor") {
    const walletOrPosition = fields.walletOrPosition || target;
    if (!walletOrPosition) {
      return { ok: false, error: "Enter the wallet or lending position the agent should check." };
    }
    fields.walletOrPosition = walletOrPosition;
  }

  if (definition.capability === "yield_optimisation" && !definition.schemaDerived) {
    const yieldFields = normalizeYieldFields(fields, target);
    if (!yieldFields.ok) return yieldFields;
  }

  const requiredFieldsError = validateBnbJobDefinitionFields(definition, taskType, fields);
  if (requiredFieldsError) return { ok: false, error: requiredFieldsError };

  if (instructions.length > 1200) return { ok: false, error: "Notes are too long." };

  const boundsError = validatePriceBounds(definition.capability, fields);
  if (boundsError) {
    return { ok: false, error: boundsError };
  }

  const assumptions: string[] = [];
  const warnings: string[] = [];
  const missingInputs: string[] = [];
  const summary = [
    bnbJobTaskLabel(definition, taskType),
    definition.capability === "custom" || definition.schemaDerived ? "" : `Outcome: ${outcome}`,
    target && !definition.schemaDerived ? definition.capability === "yield_optimisation" && fields.yieldSource === BNB_YIELD_SOURCE_CONNECTED_WALLET ? `Wallet: ${target}` : `Target: ${target}` : "",
    `Risk: ${riskPreference}`,
    ...summaryBnbJobFields(definition, fields, taskType, fields.walletAddress || target).map((field) => {
      const value = fields[field.key];
      return value ? `${field.label}: ${value}` : "";
    }),
    ...(definition.capability === "yield_optimisation" && !definition.schemaDerived && fields.yieldSource === BNB_YIELD_SOURCE_CONNECTED_WALLET ? ["Scope: All wallet assets"] : []),
    instructions ? `Notes: ${instructions}` : "",
  ].filter(Boolean).join("\n");

  return {
    ok: true,
    spec: {
      capability: definition.capability,
      taskType,
      ...(endpointCapability ? { endpointCapability } : {}),
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
  if (!walletAddress || !isEvmAddress(walletAddress)) return spec;
  const existingWallet = spec.fields.walletOrPosition || spec.fields.intentTarget;
  const fields = {
    ...spec.fields,
    walletAddress,
    ...(spec.capability === "health_factor" && !existingWallet ? {
      walletOrPosition: walletAddress,
      intentTarget: walletAddress,
    } : {}),
  };
  if (fields === spec.fields || (spec.fields.walletAddress === walletAddress && (spec.capability !== "health_factor" || existingWallet))) return spec;

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
}, agent?: BnbAgentCapabilitySource): { ok: true; spec: BnbJobSpec } | { ok: false; error: string } {
  const definition = agent ? getBnbAgentJobCapability(agent, input.capability, input.taskType) : getBnbJobCapability(input.capability);
  const incomingFields = input.fields && typeof input.fields === "object" ? input.fields : {};
  const fields: Record<string, string> = {};
  const taskType = typeof input.taskType === "string" && input.taskType.trim() ? input.taskType.trim() : definition.defaultTaskType;
  if (!definition.taskTypes.includes(taskType)) return { ok: false, error: "Choose a valid task." };
  const endpointCapability = endpointCapabilityForTask(definition, taskType);
  if (definition.capability === "yield_optimisation" && !definition.schemaDerived) fields.yieldSource = defaultBnbYieldSource(taskType);

  for (const field of definition.fields) {
    const value = readField(incomingFields, field.key);
    const fieldError = validateOptionalBnbJobField(field, value);
    if (fieldError) return { ok: false, error: fieldError };
    if (value) fields[field.key] = value;
  }

  const walletAddress = readField(incomingFields, "walletAddress");
  if (isEvmAddress(walletAddress)) fields.walletAddress = walletAddress;
  applyWalletFieldDefaults(definition, fields, walletAddress);

  const instructions = typeof input.instructions === "string" ? input.instructions.trim() : "";
  if (instructions.length > 1200) return { ok: false, error: "Notes are too long." };

  if (definition.capability === "yield_optimisation" && !definition.schemaDerived) {
    const yieldFields = normalizeYieldFields(fields, fields.intentTarget || "");
    if (!yieldFields.ok) return yieldFields;
  }

  const requiredFieldsError = validateBnbJobDefinitionFields(definition, taskType, fields);
  if (requiredFieldsError) return { ok: false, error: requiredFieldsError };

  const boundsError = validatePriceBounds(definition.capability, fields);
  if (boundsError) {
    return { ok: false, error: boundsError };
  }

  const summary = summarizeBnbJobSpec({
    capability: definition.capability,
    taskType,
    ...(endpointCapability ? { endpointCapability } : {}),
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
      ...(endpointCapability ? { endpointCapability } : {}),
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

function applyWalletFieldDefaults(definition: BnbJobCapabilityDefinition, fields: Record<string, string>, walletAddress: string) {
  if (!isEvmAddress(walletAddress)) return;
  for (const field of definition.fields) {
    if (!fields[field.key] && isWalletAddressJobField(field)) {
      fields[field.key] = walletAddress;
    }
  }
}

function isWalletAddressJobField(field: BnbJobFieldDefinition) {
  const normalized = field.key.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  const label = field.label.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  const text = `${normalized} ${label}`;
  if (/(token|asset|pool|contract|router|spender|vault|pair|market)/.test(text)) return false;
  return /(walletaddress|useraddress|accountaddress|owneraddress|borroweraddress|senderaddress|address user|wallet account)/.test(text)
    || normalized === "address";
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
  const definition = getBnbJobSpecDefinition(spec);
  const lines = summaryBnbJobFields(definition, spec.fields, spec.taskType, spec.fields.walletAddress)
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
  return [bnbJobTaskLabel(definition, spec.taskType), ...lines].join("\n");
}
