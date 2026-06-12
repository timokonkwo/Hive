import { NextRequest } from 'next/server';

export const TASK_CATEGORIES = [
  'Development',
  'Analysis',
  'Security',
  'Token Launch',
  'Research',
  'Content',
  'Design',
  'Social',
  'Legal',
  'Translation',
  'Other',
] as const;

export const MAX_TASK_BODY_BYTES = 64 * 1024;
export const MAX_TASK_BUDGET_USDC = 100_000;
const TASK_CATEGORY_SET = new Set<string>(TASK_CATEGORIES);

export type TaskInputValidation =
  | {
      valid: true;
      value: {
        title: string;
        description: string;
        category: string;
        requirements: string;
        tags: string[];
        budget: string;
        budgetAmount: number;
      };
    }
  | { valid: false; error: string };

export function taskBodyTooLarge(req: NextRequest) {
  const rawLength = req.headers.get('content-length');
  const length = rawLength ? Number(rawLength) : 0;
  return Number.isFinite(length) && length > MAX_TASK_BODY_BYTES;
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => cleanString(tag, 32))
    .filter((tag) => /^[a-z0-9][a-z0-9 +#._-]{0,31}$/i.test(tag))
    .slice(0, 8);
}

export function parseTaskBudgetAmount(budget: unknown) {
  const raw = typeof budget === 'string' ? budget.trim() : '';
  if (!raw || /^negotiable$/i.test(raw)) return 0;
  if (raw.includes('-')) return NaN;
  const match = raw.match(/(?:\$|^)\s*([0-9]+(?:\.[0-9]{1,2})?)(?:\s*(?:USDC|USD))?$/i);
  if (!match) return NaN;
  return Number(match[1]);
}

export function validateHumanTaskInput(input: {
  title: unknown;
  description: unknown;
  category: unknown;
  tags?: unknown;
  requirements?: unknown;
  budget?: unknown;
}): TaskInputValidation {
  const title = cleanString(input.title, 120);
  const description = cleanString(input.description, 5000);
  const category = cleanString(input.category, 80);
  const requirements = cleanString(input.requirements, 4000);
  const tags = cleanTags(input.tags);
  const budget = cleanString(input.budget, 80) || 'Negotiable';
  const budgetAmount = parseTaskBudgetAmount(budget);

  if (title.length < 8) {
    return { valid: false, error: 'Task title must be at least 8 characters.' };
  }
  if (description.length < 40) {
    return { valid: false, error: 'Task description must be at least 40 characters.' };
  }
  if (!TASK_CATEGORY_SET.has(category)) {
    return { valid: false, error: 'Invalid task category.' };
  }
  if (!Number.isFinite(budgetAmount) || budgetAmount < 0 || budgetAmount > MAX_TASK_BUDGET_USDC) {
    return { valid: false, error: `Budget must be Negotiable or a USDC amount up to ${MAX_TASK_BUDGET_USDC}.` };
  }

  return {
    valid: true,
    value: { title, description, category, requirements, tags, budget, budgetAmount },
  };
}
