/**
 * Submission Validation
 *
 * Validates agent deliverables against the specs defined by the client at task creation.
 * Ensures agents deliver what was asked for, not hallucinated content.
 */

/* ── Types ─────────────────────────────────────────────────────────── */

/** What the client expects from the agent (set at task creation). */
export interface DeliverableSpec {
  type: 'file' | 'url' | 'text' | 'code' | 'image' | 'token_launch';
  label: string;
  description?: string;
  required: boolean;
  maxSizeBytes?: number;
  allowedExtensions?: string[];
}

/** What the agent submits. */
export interface DeliverableSubmission {
  specIndex: number;       // Maps to which spec this fulfills
  type: 'file' | 'url' | 'text' | 'code' | 'image' | 'token_launch';
  label: string;
  content: string;         // URL, text, file ID, or mint address
  metadata?: Record<string, any>;
}

/** Token-specific config set by client for "Token Launch" tasks. */
export interface TokenConfig {
  name: string;
  symbol: string;
  description: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  feeSharing?: Array<{ walletAddress: string; bps: number; label?: string }>;
  initialBuyAmountSol?: number;
}

/* ── Validation ────────────────────────────────────────────────────── */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_TYPES = ['file', 'url', 'text', 'code', 'image', 'token_launch'] as const;
type DeliverableType = typeof VALID_TYPES[number];

/**
 * Validate a submission against the task's deliverable specs.
 */
export function validateSubmission(
  specs: DeliverableSpec[],
  deliverables: DeliverableSubmission[],
  summary: string
): ValidationResult {
  const errors: string[] = [];

  // 1. Summary validation
  if (!summary || typeof summary !== 'string') {
    errors.push('Summary is required.');
  } else if (summary.trim().length < 20) {
    errors.push('Summary must be at least 20 characters.');
  } else if (summary.length > 5000) {
    errors.push('Summary must be 5000 characters or less.');
  }

  // 2. Must have at least one deliverable
  if (!deliverables || !Array.isArray(deliverables) || deliverables.length === 0) {
    errors.push('At least one deliverable is required.');
    return { valid: false, errors };
  }

  // 3. Validate each deliverable
  const usedSpecIndices = new Set<number>();

  for (let i = 0; i < deliverables.length; i++) {
    const d = deliverables[i];
    const prefix = `Deliverable #${i + 1}`;

    // Type check
    if (!d.type || !VALID_TYPES.includes(d.type as DeliverableType)) {
      errors.push(`${prefix}: Invalid type "${d.type}". Must be one of: ${VALID_TYPES.join(', ')}`);
      continue;
    }

    // Content check
    if (!d.content || typeof d.content !== 'string' || d.content.trim().length === 0) {
      errors.push(`${prefix}: Content is required.`);
      continue;
    }

    // Spec index check (if specs exist)
    if (specs.length > 0) {
      if (typeof d.specIndex !== 'number' || d.specIndex < 0 || d.specIndex >= specs.length) {
        errors.push(`${prefix}: specIndex ${d.specIndex} is out of range (0-${specs.length - 1}).`);
        continue;
      }

      // Check for duplicate spec fulfillment
      if (usedSpecIndices.has(d.specIndex)) {
        errors.push(`${prefix}: Spec #${d.specIndex} already fulfilled by another deliverable.`);
        continue;
      }
      usedSpecIndices.add(d.specIndex);

      // Type must match spec
      const spec = specs[d.specIndex];
      if (d.type !== spec.type) {
        errors.push(`${prefix}: Type "${d.type}" doesn't match spec "${spec.label}" (expected "${spec.type}").`);
      }
    }

    // Type-specific validation
    validateDeliverableContent(d, prefix, errors);
  }

  // 4. Check all required specs are fulfilled
  if (specs.length > 0) {
    for (let i = 0; i < specs.length; i++) {
      if (specs[i].required && !usedSpecIndices.has(i)) {
        errors.push(`Missing required deliverable: "${specs[i].label}" (spec #${i}).`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type-specific content validation.
 */
function validateDeliverableContent(
  d: DeliverableSubmission,
  prefix: string,
  errors: string[]
): void {
  switch (d.type) {
    case 'url':
      try {
        new URL(d.content);
      } catch {
        errors.push(`${prefix}: "${d.content}" is not a valid URL.`);
      }
      break;

    case 'text':
      if (d.content.trim().length < 10) {
        errors.push(`${prefix}: Text deliverable must be at least 10 characters.`);
      }
      if (d.content.length > 50000) {
        errors.push(`${prefix}: Text deliverable must be 50000 characters or less.`);
      }
      break;

    case 'code':
      if (d.content.trim().length < 5) {
        errors.push(`${prefix}: Code deliverable must be at least 5 characters.`);
      }
      if (d.content.length > 100000) {
        errors.push(`${prefix}: Code deliverable must be 100000 characters or less.`);
      }
      break;

    case 'token_launch':
      // Mint address must be a valid Solana base58 address (32-44 chars)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(d.content)) {
        errors.push(`${prefix}: "${d.content}" is not a valid Solana mint address.`);
      }
      break;

    case 'file':
    case 'image':
      // Content should be a file ID or URL
      if (d.content.trim().length < 1) {
        errors.push(`${prefix}: File/image reference is required.`);
      }
      break;
  }
}

/**
 * Validate token config at task creation.
 */
export function validateTokenConfig(config: any): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    errors.push('tokenConfig is required for Token Launch tasks.');
    return { valid: false, errors };
  }

  if (!config.name || typeof config.name !== 'string') {
    errors.push('tokenConfig.name is required.');
  } else if (config.name.length > 32) {
    errors.push('tokenConfig.name must be 32 characters or less.');
  }

  if (!config.symbol || typeof config.symbol !== 'string') {
    errors.push('tokenConfig.symbol is required.');
  } else if (config.symbol.length > 10) {
    errors.push('tokenConfig.symbol must be 10 characters or less.');
  }

  if (!config.description || typeof config.description !== 'string') {
    errors.push('tokenConfig.description is required.');
  } else if (config.description.length > 500) {
    errors.push('tokenConfig.description must be 500 characters or less.');
  }

  if (config.feeSharing) {
    if (!Array.isArray(config.feeSharing)) {
      errors.push('tokenConfig.feeSharing must be an array.');
    } else {
      const totalBps = config.feeSharing.reduce((sum: number, c: any) => sum + (c.bps || 0), 0);
      if (totalBps !== 10000) {
        errors.push(`tokenConfig.feeSharing BPS must total 10000, got ${totalBps}.`);
      }
      for (const claimer of config.feeSharing) {
        if (!claimer.walletAddress || !claimer.bps) {
          errors.push('Each fee sharing entry must have walletAddress and bps.');
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate deliverable specs at task creation.
 */
export function validateDeliverableSpecs(specs: any[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(specs)) {
    errors.push('deliverableSpecs must be an array.');
    return { valid: false, errors };
  }

  if (specs.length === 0) {
    errors.push('At least one deliverable spec is required.');
    return { valid: false, errors };
  }

  if (specs.length > 10) {
    errors.push('Maximum 10 deliverable specs allowed.');
    return { valid: false, errors };
  }

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const prefix = `Spec #${i}`;

    if (!s.type || !VALID_TYPES.includes(s.type)) {
      errors.push(`${prefix}: Invalid type "${s.type}". Must be one of: ${VALID_TYPES.join(', ')}`);
    }

    if (!s.label || typeof s.label !== 'string' || s.label.length > 100) {
      errors.push(`${prefix}: label is required and must be 100 chars or less.`);
    }

    if (typeof s.required !== 'boolean') {
      errors.push(`${prefix}: required must be a boolean.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
