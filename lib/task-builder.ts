const MAX_RUBRIC_ITEMS = 8;
const MAX_RUBRIC_ITEM_LENGTH = 180;

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: 'Token Launch', keywords: ['token', 'solana', 'bags', 'mint', 'memecoin', 'coin'] },
  { category: 'Development', keywords: ['build', 'app', 'website', 'api', 'code', 'frontend', 'backend', 'smart contract'] },
  { category: 'Analysis', keywords: ['analyze', 'analysis', 'data', 'dashboard', 'forecast', 'model', 'metrics'] },
  { category: 'Research', keywords: ['research', 'compare', 'market', 'competitor', 'report', 'sources'] },
  { category: 'Content', keywords: ['write', 'copy', 'blog', 'docs', 'email', 'article', 'content'] },
  { category: 'Social', keywords: ['twitter', 'x ', 'linkedin', 'social', 'posts', 'thread', 'calendar'] },
  { category: 'Design', keywords: ['design', 'brand', 'logo', 'mockup', 'figma', 'ui'] },
  { category: 'Security', keywords: ['audit', 'security', 'vulnerability', 'pentest', 'threat'] },
];

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

export function validateAcceptanceRubric(value: unknown): { valid: boolean; rubric: string[]; errors: string[] } {
  if (value === undefined || value === null || value === '') {
    return { valid: true, rubric: [], errors: [] };
  }

  if (!Array.isArray(value)) {
    return { valid: false, rubric: [], errors: ['acceptanceRubric must be an array of strings.'] };
  }

  if (value.length > MAX_RUBRIC_ITEMS) {
    return { valid: false, rubric: [], errors: [`acceptanceRubric can include at most ${MAX_RUBRIC_ITEMS} items.`] };
  }

  const errors: string[] = [];
  const rubric = value
    .map((item, index) => {
      const cleaned = cleanText(item, MAX_RUBRIC_ITEM_LENGTH);
      if (!cleaned) errors.push(`acceptanceRubric[${index}] must be a non-empty string.`);
      if (typeof item === 'string' && item.trim().length > MAX_RUBRIC_ITEM_LENGTH) {
        errors.push(`acceptanceRubric[${index}] must be ${MAX_RUBRIC_ITEM_LENGTH} characters or less.`);
      }
      return cleaned;
    })
    .filter(Boolean);

  return { valid: errors.length === 0, rubric, errors };
}

function inferCategory(prompt: string, requested?: string): string {
  if (requested) return requested;
  const lower = prompt.toLowerCase();
  let best = { category: 'Research', hits: 0 };

  for (const entry of CATEGORY_KEYWORDS) {
    const hits = entry.keywords.filter((keyword) => lower.includes(keyword)).length;
    if (hits > best.hits) best = { category: entry.category, hits };
  }

  return best.category;
}

function titleFromPrompt(prompt: string, category: string): string {
  const sentence = prompt.split(/[.!?]/)[0]?.trim() || prompt;
  const compact = sentence.replace(/^(i need|please|can you|help me|we need)\s+/i, '').trim();
  const title = compact.length > 8 ? compact : `${category} task`;
  return title.charAt(0).toUpperCase() + title.slice(1, 90);
}

function inferTags(prompt: string, category: string): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !['with', 'that', 'from', 'this', 'have', 'need', 'into', 'your', 'using'].includes(word));

  return Array.from(new Set([category, ...words.slice(0, 5)]));
}

function inferBudget(prompt: string, requested?: string): string {
  if (requested) return requested;
  const match = prompt.match(/\$?\b(\d{2,5})(?:\s?(?:usd|usdc|dollars))?\b/i);
  return match ? `$${match[1]} USDC` : 'Negotiable';
}

function defaultRubric(category: string): string[] {
  const common = [
    'Deliverables directly address every stated requirement.',
    'Final output is clear, complete, and ready for client review.',
  ];

  if (category === 'Research' || category === 'Analysis') {
    return [
      'Findings include specific data points, assumptions, and source references where applicable.',
      'Recommendations are supported by the evidence gathered.',
      ...common,
    ];
  }
  if (category === 'Development') {
    return [
      'Implementation includes setup or usage notes needed to verify the work.',
      'Code or technical output is structured, readable, and handles obvious failure cases.',
      ...common,
    ];
  }
  if (category === 'Content' || category === 'Social') {
    return [
      'Copy follows the requested format, audience, and publishing channel.',
      'Tone is consistent and free of obvious grammar or formatting issues.',
      ...common,
    ];
  }
  if (category === 'Token Launch') {
    return [
      'Token launch details match the submitted name, symbol, and brief.',
      'Launch proof includes the mint address or verifiable launch URL.',
      ...common,
    ];
  }

  return common;
}

export function buildTaskDraft(input: {
  prompt: string;
  category?: string;
  budget?: string;
  acceptanceRubric?: unknown;
}) {
  const prompt = cleanText(input.prompt, 4000);
  const category = inferCategory(prompt, cleanText(input.category, 80));
  const rubricResult = validateAcceptanceRubric(input.acceptanceRubric);
  const acceptanceRubric = rubricResult.rubric.length > 0 ? rubricResult.rubric : defaultRubric(category);
  const title = titleFromPrompt(prompt, category);

  return {
    title,
    description: prompt,
    category,
    requirements: `Scope: ${prompt}\n\nExpected review criteria:\n${acceptanceRubric.map((item) => `- ${item}`).join('\n')}`,
    tags: inferTags(prompt, category),
    budget: inferBudget(prompt, cleanText(input.budget, 80)),
    deliverableSpecs: [
      {
        type: category === 'Token Launch' ? 'token_launch' : 'text',
        label: category === 'Token Launch' ? 'Launch proof' : 'Final deliverable',
        description: `Complete the ${category.toLowerCase()} task and provide verifiable output.`,
        required: true,
      },
    ],
    acceptanceRubric,
    confidence: prompt.length > 120 ? 'high' : 'medium',
  };
}
