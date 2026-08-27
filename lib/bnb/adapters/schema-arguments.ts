import type { BnbActivationRecord, BnbAgentProfile } from "@/lib/bnb/types";

type ArgumentAgent = Pick<
  BnbAgentProfile,
  "chainId" | "name" | "description" | "capabilities" | "services" | "sourceMetrics"
>;

type ArgumentRecord = Pick<BnbActivationRecord, "clientAddress" | "jobSpec" | "limits">;

export function asSchemaRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export function parseSchemaRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return asSchemaRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return asSchemaRecord(value);
}

export function normalizeEndpointInputSchema(value: unknown): Record<string, unknown> {
  const schema = parseSchemaRecord(value);
  if (schema.properties || schema.type === "object") return schema;

  for (const key of ["inputSchema", "input_schema", "parameters", "schema", "jsonSchema", "json_schema"]) {
    const nested = parseSchemaRecord(schema[key]);
    if (nested.properties || nested.type === "object") return nested;
  }

  return schema;
}

export function schemaTypeIncludes(property: Record<string, unknown>, expected: string): boolean {
  const type = property.type;
  if (type === expected) return true;
  if (Array.isArray(type) && type.includes(expected)) return true;
  return schemaVariants(property).some((variant) => schemaTypeIncludes(variant, expected));
}

export function schemaVariants(property: Record<string, unknown>): Record<string, unknown>[] {
  return ["anyOf", "oneOf", "allOf"]
    .flatMap((key) => Array.isArray(property[key]) ? property[key] as unknown[] : [])
    .map(parseSchemaRecord);
}

export function enumValuesForSchema(property: Record<string, unknown>) {
  const itemSchema = asSchemaRecord(property.items);
  return uniqueStrings([
    ...(Array.isArray(property.enum) ? property.enum : []),
    ...(Array.isArray(itemSchema.enum) ? itemSchema.enum : []),
    ...schemaVariants(property).flatMap((variant) => {
      const variantItems = asSchemaRecord(variant.items);
      return [
        ...(Array.isArray(variant.enum) ? variant.enum : []),
        ...(Array.isArray(variantItems.enum) ? variantItems.enum : []),
      ];
    }),
  ].filter((item): item is string => typeof item === "string"));
}

export function enumValueForSchema(property: Record<string, unknown>, candidates: string[]) {
  const enumValues = enumValuesForSchema(property);
  if (enumValues.length === 0) return "";
  const lowerCandidates = candidates
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean);
  return enumValues.find((value) => lowerCandidates.includes(value.toLowerCase())) || "";
}

export function firstEnumValueForSchema(property: Record<string, unknown>) {
  return enumValuesForSchema(property)[0] || "";
}

export function normalizeSchemaPropertyName(value: string) {
  return value.replace(/[_\-\s]+/g, "").toLowerCase();
}

export function firstEvmAddress(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const match = value.match(/0x[a-fA-F0-9]{40}/);
    if (match) return match[0];
  }
  return "";
}

export function directSchemaFieldValue(fields: Record<string, string>, key: string) {
  const normalizedKey = normalizeSchemaPropertyName(key);
  const directKey = Object.keys(fields).find((fieldKey) => normalizeSchemaPropertyName(fieldKey) === normalizedKey);
  return fields[key] || fields[normalizedKey] || (directKey ? fields[directKey] : "");
}

export function coerceSchemaValue(property: Record<string, unknown>, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = parseJsonFieldValue(value);
  if (schemaTypeIncludes(property, "object")) {
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : undefined;
  }
  if (schemaTypeIncludes(property, "array")) {
    const values = Array.isArray(parsed) ? parsed : [parsed];
    const enumValues = enumValuesForSchema(property);
    const coerced = values
      .map((item) => enumValues.length > 0 ? enumValueForSchema(property, [String(item)]) : item)
      .filter((item) => item !== undefined && item !== null && item !== "");
    return coerced.length > 0 ? coerced : undefined;
  }
  if (schemaTypeIncludes(property, "integer")) {
    const parsedInteger = Number.parseInt(String(parsed), 10);
    return Number.isFinite(parsedInteger) ? parsedInteger : undefined;
  }
  if (schemaTypeIncludes(property, "number")) {
    const parsedNumber = Number.parseFloat(String(parsed));
    return Number.isFinite(parsedNumber) ? parsedNumber : undefined;
  }
  if (schemaTypeIncludes(property, "boolean")) {
    if (typeof parsed === "boolean") return parsed;
    if (/^(true|yes|1)$/i.test(String(parsed))) return true;
    if (/^(false|no|0)$/i.test(String(parsed))) return false;
    return undefined;
  }
  if (enumValuesForSchema(property).length > 0) {
    return enumValueForSchema(property, [String(parsed)]) || undefined;
  }
  return String(parsed);
}

export function parseJsonFieldValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function chainNameForSchema(property: Record<string, unknown>): string {
  const enumValues = enumValuesForSchema(property);
  const preferred = ["BSC", "BNB Smart Chain", "BNB Chain", "bsc", "bnb"];
  return preferred.find((candidate) => enumValues.includes(candidate)) || enumValues[0] || "BSC";
}

export function protocolForSchema(
  property: Record<string, unknown>,
  agent: ArgumentAgent,
  record: ArgumentRecord,
  requestedProtocol?: unknown,
) {
  const enumValues = enumValuesForSchema(property);
  const candidates = protocolCandidatesForSchema(property, agent, record, requestedProtocol);
  const enumMatch = enumValueForSchema(property, candidates);
  if (enumMatch) return enumMatch;
  if (enumValues.length === 1) return enumValues[0];
  if (enumValues.length > 0) return enumValueMentionedInContext(property, protocolContextTexts(agent, record)) || "";
  return candidates[0] || "";
}

export function poolForSchema(
  property: Record<string, unknown>,
  agent: ArgumentAgent,
  record: ArgumentRecord,
  requestedPool?: unknown,
) {
  const fields = record.jobSpec?.fields || {};
  const explicitCandidates = uniqueStrings([
    ...candidateStrings(requestedPool),
    ...candidateStrings(fields.pool),
    ...candidateStrings(fields.poolName),
    ...candidateStrings(fields.poolId),
    ...candidateStrings(fields.poolOrPair),
    ...candidateStrings(fields.market),
    ...candidateStrings(fields.intentTarget),
  ].filter((value) => !isGenericSelectionValue(value)).flatMap(poolAliases));
  const explicitMatch = enumValueForSchema(property, explicitCandidates);
  if (explicitMatch) return explicitMatch;

  const protocolCandidates = protocolCandidatesForSchema(property, agent, record);
  const protocolMatch = enumValueForSchema(
    property,
    protocolCandidates.flatMap((candidate) => poolAliases(candidate)),
  );
  if (protocolMatch) return protocolMatch;

  const contextMatch = enumValueMentionedInContext(property, protocolContextTexts(agent, record));
  if (contextMatch) return contextMatch;

  const enumValues = enumValuesForSchema(property);
  if (enumValues.length === 1) return enumValues[0];
  return explicitCandidates.find((candidate) => !isGenericSelectionValue(candidate)) || "";
}

export function isGenericSelectionValue(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return true;
  const normalized = normalizeSchemaPropertyName(text);
  return [
    "all",
    "allsupported",
    "allprotocols",
    "allmarkets",
    "any",
    "anysupported",
    "anyprotocol",
    "anymarket",
    "nopreference",
    "auto",
    "automatic",
  ].includes(normalized) || normalized.startsWith("select");
}

function protocolCandidatesForSchema(
  property: Record<string, unknown>,
  agent: ArgumentAgent,
  record: ArgumentRecord,
  requestedProtocol?: unknown,
) {
  const fields = record.jobSpec?.fields || {};
  const explicit = [
    requestedProtocol,
    fields.protocol,
    fields.protocols,
    fields.project,
    fields.projects,
    fields.platform,
    fields.platforms,
    fields.market,
    fields.markets,
    fields.lendingProject,
    fields.lendingProtocol,
    fields.dex,
    fields.dexName,
    fields.exchange,
  ].flatMap(candidateStrings).filter((value) => !isGenericSelectionValue(value));

  const contextTexts = protocolContextTexts(agent, record);
  return uniqueStrings([
    ...explicit.flatMap(protocolAliases),
    ...knownProtocolNamesFromText(contextTexts.join(" ")).flatMap(protocolAliases),
    ...enumValuesMentionedInContext(property, contextTexts).flatMap(protocolAliases),
  ]).filter((value) => !isGenericSelectionValue(value));
}

function protocolContextTexts(agent: ArgumentAgent, record: ArgumentRecord) {
  return [
    ...(agent.sourceMetrics?.supportedProtocols || []),
    agent.name,
    agent.description,
    ...(agent.capabilities || []),
    ...((agent.services || []).flatMap((service) => [service.name, service.type, service.endpoint || ""])),
    record.jobSpec?.taskType || "",
    record.jobSpec?.summary || "",
    record.jobSpec?.expectedOutput || "",
    record.limits.task,
  ].filter(Boolean);
}

function enumValueMentionedInContext(property: Record<string, unknown>, contextTexts: string[]) {
  return enumValuesMentionedInContext(property, contextTexts)[0] || "";
}

function enumValuesMentionedInContext(property: Record<string, unknown>, contextTexts: string[]) {
  const compactContext = contextTexts
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
  if (!compactContext) return [];

  return enumValuesForSchema(property).filter((value) => {
    const compactValue = value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
    return compactValue.length >= 3 && compactContext.includes(compactValue);
  });
}

function candidateStrings(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const parsed = parseJsonFieldValue(value);
  if (Array.isArray(parsed)) return parsed.flatMap(candidateStrings);
  if (typeof parsed === "object") {
    return Object.values(asSchemaRecord(parsed)).flatMap(candidateStrings);
  }
  return String(parsed)
    .split(/[,\n;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function knownProtocolNamesFromText(value: string) {
  const text = value.toLowerCase();
  const protocols: string[] = [];
  if (/\bpancake(?:swap)?\b/.test(text)) protocols.push("PancakeSwap");
  if (/\bvenus\b/.test(text)) protocols.push("Venus");
  if (/\blista\b/.test(text)) protocols.push("Lista");
  if (/\baave\b/.test(text)) protocols.push("Aave");
  if (/\bbeefy\b/.test(text)) protocols.push("Beefy");
  if (/\buniswap\b/.test(text)) protocols.push("Uniswap");
  if (/\bwagmi\b/.test(text)) protocols.push("WAGMI");
  if (/\boku(?:trade)?\b/.test(text)) protocols.push("OkuTrade");
  return protocols;
}

function protocolAliases(protocol: string) {
  const normalized = protocol.trim().toLowerCase();
  if (!normalized) return [];
  if (normalized.includes("pancake")) return [protocol, "PancakeSwap", "Pancake Swap", "pancakeswap", "pancake"];
  if (normalized.includes("venus")) return [protocol, "Venus", "venus", "VENUS"];
  if (normalized.includes("lista")) return [protocol, "Lista", "lista", "LISTA"];
  if (normalized.includes("aave")) return [protocol, "Aave", "aave", "AAVE"];
  if (normalized.includes("beefy")) return [protocol, "Beefy", "beefy", "BEEFY"];
  if (normalized.includes("uniswap")) return [protocol, "Uniswap", "uniswap", "UNISWAP"];
  if (normalized.includes("wagmi")) return [protocol, "WAGMI", "wagmi"];
  if (normalized.includes("oku")) return [protocol, "OkuTrade", "Oku", "okutrade", "oku"];
  return [protocol];
}

function poolAliases(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return [];
  if (normalized.includes("liquid") || normalized.includes("lst") || normalized.includes("staked") || normalized.includes("lista")) {
    return [
      value,
      "Liquid Staked BNB",
      "Liquid Staked BNB Pool",
      "Liquid Staking",
      "LST",
      "lst",
    ];
  }
  if (normalized.includes("stable")) {
    return [
      value,
      "Stablecoins",
      "Stablecoin",
      "Stablecoin Pool",
      "Stable",
      "stable",
    ];
  }
  if (normalized.includes("core") || normalized.includes("venus")) {
    return [
      value,
      "Core",
      "Core Pool",
      "core",
      "core pool",
      "Main",
      "Main Pool",
      "main",
      "main pool",
    ];
  }
  return [value];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
