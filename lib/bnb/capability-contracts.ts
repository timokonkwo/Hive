import type { BnbEndpointCapabilityContract, BnbJobCapability } from "@/lib/bnb/types";

export function endpointCapabilityText(contract: BnbEndpointCapabilityContract) {
  const schema = asRecord(contract.inputSchema);
  const properties = asRecord(schema.properties);
  const propertyText = Object.entries(properties)
    .map(([key, value]) => `${key} ${schemaText(value)}`)
    .join(" ");

  return [
    contract.name,
    contract.description,
    ...(contract.tags || []),
    propertyText,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function isActionableBnbEndpointCapability(contract: BnbEndpointCapabilityContract) {
  if (!contract.name.trim()) return false;
  const text = endpointCapabilityText(contract);
  if (isDirectoryCapabilityText(text)) return false;
  if (isDocumentationCapabilityText(text, contract)) return false;
  if (isTransportCapabilityText(text, contract)) return false;
  return true;
}

export function bnbJobCapabilityForEndpointContract(contract: BnbEndpointCapabilityContract): BnbJobCapability {
  const text = endpointCapabilityText(contract).replace(/[_-]+/g, " ");
  const compact = text.replace(/[^a-z0-9]+/g, "");

  if (
    /\bv3\b|concentrated|tick|liquidity\s*position|price\s*range|pool\s*price/.test(text) ||
    /createposition|estimateamounts|predefinedpriceranges|getcurrentpoolprice|getdexinfo/.test(compact)
  ) {
    return "concentrated_liquidity";
  }

  if (/health\s*factor|health\s*indicator|liquidation|account\s*liquidity|borrow\s*limit|shortfall|borrow\s*position|collateral/.test(text)) {
    return "health_factor";
  }

  if (/grid|grid\s*trading|bounds|trading\s*range|market\s*making/.test(text)) {
    return "grid_trading";
  }

  if (/yield|apy|apr|vault|farm|staking|deposit|supply|earn|stablecoin|usdd|beefy/.test(text)) {
    return "yield_optimisation";
  }

  if (/rebalance|rebalancing|allocation|lp\s*position|portfolio\s*weight/.test(text)) {
    return "rebalancing";
  }

  return "custom";
}

export function humanizeEndpointCapabilityName(value: string) {
  const withSpaces = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_/:.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withSpaces) return "Run agent";
  return withSpaces.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizedEndpointCapabilityName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function isDirectoryCapabilityText(text: string) {
  const spaced = text.replace(/[_-]+/g, " ");
  const compact = spaced.replace(/[^a-z0-9]+/g, "");
  return (
    /(?:^|[^a-z])(list|search|browse|discover|get)\s+(?:all\s+)?(?:agents?|nfas?|erc8004\s+agents?|sly\s+agents?)(?:[^a-z]|$)/.test(spaced) ||
    /(?:listagents|searchagents|browseagents|discoveragents|getagents|getallagents|listnfas|searchnfas|getnfas|nfadirectory|agentdirectory|erc8004agents|slyagents)/.test(compact) ||
    (/\bagents?\b/.test(spaced) && /(?:nfatokenid|erc8004agentid|slywalletaddress|riskprofile)/.test(compact))
  );
}

function isDocumentationCapabilityText(text: string, contract: BnbEndpointCapabilityContract) {
  const schema = asRecord(contract.inputSchema);
  const propertyCount = Object.keys(asRecord(schema.properties)).length;
  const spaced = text.replace(/[_-]+/g, " ");
  const compact = spaced.replace(/[^a-z0-9]+/g, "");
  return (
    /(?:^|[^a-z])(help|guide|docs|documentation|overview|description|instructions|how\s+to|tutorial)(?:[^a-z]|$)/.test(spaced) ||
    /(?:getdescription|protocoloverview|documentation|instructions|tutorial|howto|userguide|usageguide)/.test(compact)
  ) && propertyCount <= 2;
}

function isTransportCapabilityText(text: string, contract: BnbEndpointCapabilityContract) {
  const schema = asRecord(contract.inputSchema);
  const propertyCount = Object.keys(asRecord(schema.properties)).length;
  const normalized = text.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return propertyCount === 0 && /^(?:ok|status|health|ping|ready|heartbeat|agent ?402|402 ?index|x402(?: direct)?|the ?402|api|http|endpoint|service|tool)$/.test(normalized);
}

function schemaText(value: unknown): string {
  const record = asRecord(value);
  const itemRecord = asRecord(record.items);
  return [
    record.title,
    record.description,
    Array.isArray(record.enum) ? record.enum.join(" ") : "",
    Array.isArray(itemRecord.enum) ? itemRecord.enum.join(" ") : "",
  ].filter(Boolean).join(" ");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}
