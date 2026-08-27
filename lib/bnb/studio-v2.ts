function envFlag(name: string, defaultValue = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

export type BnbStudioV2Readiness = {
  studio: {
    enabled: boolean;
    apiConfigured: boolean;
    projectConfigured: boolean;
    paymasterEnabled: boolean;
    referenceAgentsConfigured: boolean;
    referenceAgentSigningConfigured: boolean;
    referenceAgentWebhookConfigured: boolean;
  };
  commerce: {
    erc8183Enabled: boolean;
    x402Enabled: boolean;
    zeroPriceRunsEnabled: boolean;
  };
  data: {
    scanProConfigured: boolean;
    scanCacheTtlSeconds: number;
    scanTimeoutMs: number;
  };
  partners: {
    altanaEnabled: boolean;
    altanaApiConfigured: boolean;
    altanaExplorerConfigured: boolean;
    altanaKeystoreConfigured: boolean;
    pancakeSwapEnabled: boolean;
    pancakeSwapApiConfigured: boolean;
    pancakeSwapSubgraphConfigured: boolean;
    pancakeSwapDeepLinksConfigured: boolean;
    termixReportEnabled: boolean;
    termixEvidenceStorageConfigured: boolean;
  };
  observability: {
    analyticsEnabled: boolean;
    adminConfigured: boolean;
    errorWebhookConfigured: boolean;
  };
};

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name]?.trim() || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function getBnbStudioV2Readiness(): BnbStudioV2Readiness {
  return {
    studio: {
      enabled: envFlag("BNB_AGENT_STUDIO_ENABLED", true),
      apiConfigured: envPresent("BNB_AGENT_STUDIO_API_BASE") && envPresent("BNB_AGENT_STUDIO_API_KEY"),
      projectConfigured: envPresent("BNB_AGENT_STUDIO_PROJECT_ID"),
      paymasterEnabled: envFlag("BNB_AGENT_STUDIO_PAYMASTER_ENABLED", true),
      referenceAgentsConfigured: envPresent("BNB_REFERENCE_AGENTS_JSON"),
      referenceAgentSigningConfigured: envPresent("BNB_REFERENCE_AGENT_SIGNING_KEY"),
      referenceAgentWebhookConfigured: envPresent("BNB_REFERENCE_AGENT_WEBHOOK_SECRET"),
    },
    commerce: {
      erc8183Enabled: envFlag("BNB_ERC8183_ENABLED", true),
      x402Enabled: envFlag("BNB_X402_ENABLED", true),
      zeroPriceRunsEnabled: envFlag("BNB_ZERO_PRICE_RUNS_ENABLED", true),
    },
    data: {
      scanProConfigured: envPresent("BNB_8004SCAN_PRO_API_KEY") || envPresent("BNB_8004SCAN_API_KEY"),
      scanCacheTtlSeconds: boundedInteger("BNB_8004SCAN_CACHE_TTL_SECONDS", 300, 30, 3600),
      scanTimeoutMs: boundedInteger("BNB_8004SCAN_TIMEOUT_MS", 3000, 500, 15000),
    },
    partners: {
      altanaEnabled: envFlag("BNB_ALTANA_ENABLED", true),
      altanaApiConfigured: envPresent("BNB_ALTANA_API_BASE") && envPresent("BNB_ALTANA_API_KEY"),
      altanaExplorerConfigured: envPresent("BNB_ALTANA_EXPLORER_BASE"),
      altanaKeystoreConfigured: envPresent("BNB_ALTANA_KEYSTORE_ADDRESS"),
      pancakeSwapEnabled: envFlag("BNB_PANCAKESWAP_ENABLED", true),
      pancakeSwapApiConfigured: envPresent("BNB_PANCAKESWAP_API_BASE"),
      pancakeSwapSubgraphConfigured: envPresent("BNB_PANCAKESWAP_SUBGRAPH_URL"),
      pancakeSwapDeepLinksConfigured: envPresent("BNB_PANCAKESWAP_DEEPLINK_BASE"),
      termixReportEnabled: envFlag("BNB_TERMIX_REPORT_ENABLED", true),
      termixEvidenceStorageConfigured: envPresent("BNB_TERMIX_EVIDENCE_BUCKET_URL"),
    },
    observability: {
      analyticsEnabled: envFlag("BNB_MARKETPLACE_ANALYTICS_ENABLED", true),
      adminConfigured: envPresent("BNB_MARKETPLACE_ADMIN_SECRET"),
      errorWebhookConfigured: envPresent("BNB_MARKETPLACE_ERROR_WEBHOOK_URL"),
    },
  };
}
